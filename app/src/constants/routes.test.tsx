import {describe, expect, it} from 'vitest';
import {
  getEditRecordRoute,
  getNotebookRoute,
  INDIVIDUAL_NOTEBOOK_ROUTE,
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
