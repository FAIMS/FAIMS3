// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {buildTemplatesListRequest} from './queries';

describe('buildTemplatesListRequest', () => {
  it('includes limit and startKey in the query key and request URL', () => {
    const {path, queryKey} = buildTemplatesListRequest({
      limit: 10,
      startKey: 'tpl-cursor',
      includeArchived: true,
      teamId: 'team-1',
    });
    expect(path).toBe(
      '/api/templates?includeArchived=true&teamId=team-1&limit=10&startKey=tpl-cursor'
    );
    expect(queryKey).toEqual([
      'templates',
      'archived',
      'team-1',
      10,
      'tpl-cursor',
    ]);
  });

  it('omits startKey from the first-page URL', () => {
    const {path, queryKey} = buildTemplatesListRequest({limit: 10});
    expect(path).toBe('/api/templates?limit=10');
    expect(queryKey).toEqual(['templates', 'active', null, 10, null]);
  });
});
