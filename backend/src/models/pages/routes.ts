import { type Response, Router } from 'express';
import type { Api } from 'shared';
import { match } from 'venum';
import type { Services } from '../../services/index.ts';
import { addPage, getPage, listPages } from './controller.ts';
import { AddPageInput, Link, Page, PageDetailQuery, Pagination } from './types.ts';

const HEARTBEAT_MS = 20_000;

export const pagesRoutes = (services: Services): Router => {
  const router = Router();

  router.post('/', async (req, res) => {
    await match(AddPageInput.parse(req.body), {
      invalid: (error) => badRequest(res, error),
      ok: async (input) =>
        match(await addPage(services, input), {
          created: (page) => res.status(201).json(Page.toApi(page) satisfies Api.Page),
          alreadyExists: (page) =>
            res.status(409).json({
              message: 'This page was already added',
              page: Page.toApi(page),
            } satisfies Api.AlreadyExistsBody),
        }),
    });
  });

  router.get('/', async (req, res) => {
    await match(Pagination.parse(req.query), {
      invalid: (error) => badRequest(res, error),
      ok: async (pagination) =>
        match(await listPages(services, pagination), {
          ok: (result) =>
            res.json(
              Pagination.toApi(pagination, result, Page.toApi) satisfies Api.Paginated<Api.Page>,
            ),
        }),
    });
  });

  // Registered before '/:id' so that 'events' is not read as an id.
  router.get('/events', (req, res) => {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write(Sse.comment('connected'));

    const unsubscribe = services.events.onPageUpdated((event) => {
      res.write(Sse.event('page.updated', event));
    });
    const stopHeartbeat = services.scheduler.interval(HEARTBEAT_MS, () => {
      res.write(Sse.comment('heartbeat'));
    });
    req.on('close', () => {
      unsubscribe();
      stopHeartbeat();
    });
  });

  router.get('/:id', async (req, res) => {
    await match(PageDetailQuery.parse(req.params.id, req.query), {
      invalid: (error) => badRequest(res, error),
      ok: async (query) =>
        match(await getPage(services, query), {
          notFound: (error) => res.status(404).json(error satisfies Api.ErrorBody),
          ok: ({ page, links }) =>
            res.json({
              page: Page.toApi(page),
              links: Pagination.toApi(query.links, links, Link.toApi),
            } satisfies Api.PageDetail),
        }),
    });
  });

  return router;
};

const badRequest = (res: Response, error: Api.ErrorBody) => res.status(400).json(error);

/** Server-Sent Events wire format. */
export namespace Sse {
  export const event = (name: string, data: unknown): string =>
    `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

  /** Ignored by clients; keeps proxies from closing an idle stream. */
  export const comment = (text: string): string => `: ${text}\n\n`;
}
