// SPDX-License-Identifier: Apache-2.0
import {afterEach, describe, expect, it, vi} from 'vitest';
import {config} from '@/constants';
import {putArchiveTeamRequest} from './archive-hooks';

describe('putArchiveTeamRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts { archive: false } to restore a team', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    await putArchiveTeamRequest({
      teamId: 'team_1',
      token: 'tok',
      archive: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${config.apiUrl}/api/teams/team_1/archive`);
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify({archive: false}));
  });
});
