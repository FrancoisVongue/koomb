import { type Response, Router } from 'express';
import type { Api } from 'shared';
import { match } from 'venum';
import type { Services } from '../../services/index.ts';
import { Link } from '../links/types.ts';
import { addPage, getPage, listPages } from './controller.ts';
import { AddPageInput, Page, PageDetailQuery, Pagination } from './types.ts';

const HEARTBEAT_MS = 20_000;

export const pagesRoutes = (services: Services): Router => {
  const router = Router();

  router.post('/', async (req, res) => {
    const input = AddPageInput.parse(req.body);
    if (input.tag === 'invalid') {
      badRequest(res, input.data);
      return;
    }

    const result = await addPage(services, input.data);
    match(result, {
      created: (page) => {
        const body: Api.Page = Page.toApi(page);
        res.status(201).json(body);
      },
      alreadyExists: (page) => {
        const body: Api.AlreadyExistsBody = {
          message: 'This page was already added',
          page: Page.toApi(page),
        };
        res.status(409).json(body);
      },
    });
  });

  router.get('/', async (req, res) => {
    const pagination = Pagination.parse(req.query);
    if (pagination.tag === 'invalid') {
      badRequest(res, pagination.data);
      return;
    }

    const result = await listPages(services, pagination.data);
    match(result, {
      ok: (pages) => {
        const body: Api.Paginated<Api.Page> = Pagination.toApi(pagination.data, pages, Page.toApi);
        res.json(body);
      },
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
    const query = PageDetailQuery.parse(req.params.id, req.query);
    if (query.tag === 'invalid') {
      badRequest(res, query.data);
      return;
    }

    const result = await getPage(services, query.data);
    match(result, {
      notFound: (error) => {
        const body: Api.ErrorBody = error;
        res.status(404).json(body);
      },
      ok: ({ page, links }) => {
        const body: Api.PageDetail = {
          page: Page.toApi(page),
          links: Pagination.toApi(query.data.links, links, Link.toApi),
        };
        res.json(body);
      },
    });
  });

  return router;
};

const badRequest = (res: Response, error: Api.ErrorBody): void => {
  res.status(400).json(error);
};

/** Server-Sent Events wire format. */
export namespace Sse {
  export const event = (name: string, data: unknown): string =>
    `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

  /** Ignored by clients; keeps proxies from closing an idle stream. */
  export const comment = (text: string): string => `: ${text}\n\n`;
}
