// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {
  getEditRecordRoute,
  getNotebookRoute,
  getOfflineMapLayersRoute,
  INDIVIDUAL_NOTEBOOK_ROUTE,
  OFFLINE_MAP_LAYERS,
  safeReturnPath,
} from './routes';

describe('getNotebookRoute', () => {
  const notebook = {serverId: 'server', projectId: 'project'};
  const base = `${INDIVIDUAL_NOTEBOOK_ROUTE}server/project`;

  it('is the notebook itself with no plan', () => {
    expect(getNotebookRoute(notebook)).toBe(base);
  });

  it('names the plan on screen', () => {
    expect(getNotebookRoute({...notebook, planId: 'lab'})).toBe(`${base}/lab`);
  });
});

describe('getOfflineMapLayersRoute', () => {
  it('is the manager itself with no return hint', () => {
    expect(getOfflineMapLayersRoute()).toBe(OFFLINE_MAP_LAYERS);
  });

  it('encodes the screen that opened the manager', () => {
    expect(getOfflineMapLayersRoute({from: '/notebooks/server/project'})).toBe(
      `${OFFLINE_MAP_LAYERS}?from=%2Fnotebooks%2Fserver%2Fproject`
    );
  });
});

describe('safeReturnPath', () => {
  it('accepts a same-app path', () => {
    expect(safeReturnPath('/notebooks/server/project')).toBe(
      '/notebooks/server/project'
    );
  });

  it('rejects missing, protocol-relative, and absolute URLs', () => {
    expect(safeReturnPath(null)).toBeUndefined();
    expect(safeReturnPath('//example.com')).toBeUndefined();
    expect(safeReturnPath('https://example.com')).toBeUndefined();
    expect(safeReturnPath('/open?next=https://example.com')).toBeUndefined();
  });
});

describe('getEditRecordRoute', () => {
  const notebook = {serverId: 'server', projectId: 'project'};
  const base = `${INDIVIDUAL_NOTEBOOK_ROUTE}server/project`;

  it('nests the record under the notebook', () => {
    expect(getEditRecordRoute({...notebook, recordId: 'rec'})).toBe(
      `${base}/records/rec`
    );
  });

  it('nests the record under the plan it was opened from', () => {
    expect(
      getEditRecordRoute({...notebook, planId: 'lab', recordId: 'rec'})
    ).toBe(`${base}/lab/records/rec`);
  });
});
