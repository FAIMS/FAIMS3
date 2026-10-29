// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it, vi} from 'vitest';
import {filterValidTeamRoles} from './constants';

describe('filterValidTeamRoles', () => {
  it('keeps valid TEAM roles and filters out invalid roles with a warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = filterValidTeamRoles([
        'TEAM_MEMBER_CREATOR',
        'NOT_A_TEAM_ROLE',
        'TEAM_ADMIN',
      ]);
      expect(result).toEqual(['TEAM_MEMBER_CREATOR', 'TEAM_ADMIN']);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('NOT_A_TEAM_ROLE')
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});
