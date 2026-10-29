// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {Action, Role} from '@faims3/data-model';
import {
  buildTeamField,
  getPossibleTeamsForAction,
  getTeamFieldState,
} from './template-team-field';

const blue = {_id: 'blue', name: 'Blue'};
const red = {_id: 'red', name: 'Red'};

describe('map-layer team field', () => {
  it('requires a team when the user cannot create outside a team', () => {
    const field = buildTeamField({
      canCreateGlobally: false,
      possibleTeams: [blue, red],
      label: 'Team',
    });
    expect(field.clearable).toBe(false);
    expect(field.schema.safeParse(undefined).success).toBe(false);
    expect(field.schema.safeParse(blue._id).success).toBe(true);
  });

  it('lets a Super User leave team blank', () => {
    const field = buildTeamField({
      canCreateGlobally: true,
      possibleTeams: [blue, red],
      label: 'Team (optional)',
    });
    expect(field.clearable).toBe(true);
    expect(field.schema.safeParse(undefined).success).toBe(true);
  });

  it('lists only teams the user can upload into', () => {
    const teams = getPossibleTeamsForAction({
      teams: [blue, red],
      canCreateGlobally: false,
      createInTeamAction: Action.CREATE_MAP_ASSET_IN_TEAM,
      decodedToken: {
        globalRoles: [Role.GENERAL_USER],
        resourceRoles: [{resourceId: blue._id, role: Role.TEAM_MANAGER}],
      },
    });
    expect(teams).toEqual([blue]);
  });

  it('shows a required dropdown when there are several eligible teams', () => {
    const {showTeamCallout, showTeamDropdown} = getTeamFieldState({
      canCreateGlobally: false,
      possibleTeams: [blue, red],
    });
    expect(showTeamCallout).toBe(false);
    expect(showTeamDropdown).toBe(true);
  });
});
