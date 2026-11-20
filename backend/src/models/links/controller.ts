import type { Services } from '../../services/index.ts';
import type { Pagination } from '../pages/types.ts';

/** One page of the links found on a page. */
export const listLinks = async (services: Services, pageId: number, pagination: Pagination) => {
  const links = await services.db.links.listByPage(pageId, pagination);
  return links;
};
