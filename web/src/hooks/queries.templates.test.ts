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
      null,
      null,
    ]);
  });

  it('omits startKey from the first-page URL', () => {
    const {path, queryKey} = buildTemplatesListRequest({limit: 10});
    expect(path).toBe('/api/templates?limit=10');
    expect(queryKey).toEqual([
      'templates',
      'active',
      null,
      10,
      null,
      null,
      null,
    ]);
  });

  it('includes visibility in the query key and request URL', () => {
    const {path, queryKey} = buildTemplatesListRequest({
      limit: 10,
      visibility: 'public',
    });
    expect(path).toBe('/api/templates?limit=10&visibility=public');
    expect(queryKey).toEqual([
      'templates',
      'active',
      null,
      10,
      null,
      'public',
      null,
    ]);
  });

  it('sends the search text and keys each search separately', () => {
    const {path, queryKey} = buildTemplatesListRequest({
      limit: 10,
      teamId: 'team-1',
      q: 'site survey',
    });
    expect(path).toBe('/api/templates?teamId=team-1&q=site+survey&limit=10');
    expect(queryKey).toEqual([
      'templates',
      'active',
      'team-1',
      10,
      null,
      null,
      'site survey',
    ]);
    // No text is the plain list, not a search for nothing.
    expect(buildTemplatesListRequest({limit: 10, q: ''})).toEqual(
      buildTemplatesListRequest({limit: 10})
    );
  });
});
