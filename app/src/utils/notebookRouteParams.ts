import {INDIVIDUAL_NOTEBOOK_ROUTE} from '../constants/routes';

/**
 * Parse `serverId` and `projectId` from a notebook-scoped pathname.
 *
 * Matches the shared prefix used by notebook, edit-record, and view-record
 * routes (`/<notebook-plural>/:serverId/:projectId/...`).
 *
 * @returns Parsed ids, or `null` when `pathname` is not a notebook route.
 */
export function parseNotebookRouteParams(
  pathname: string
): {serverId: string; projectId: string} | null {
  if (!pathname.startsWith(INDIVIDUAL_NOTEBOOK_ROUTE)) {
    return null;
  }
  const rest = pathname.slice(INDIVIDUAL_NOTEBOOK_ROUTE.length);
  const [serverId, projectId] = rest.split('/');
  if (!serverId || !projectId) {
    return null;
  }
  return {serverId, projectId};
}
