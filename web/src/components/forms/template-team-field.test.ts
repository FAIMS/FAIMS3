// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {Action, Role} from '@faims3/data-model';
import {
  buildTeamField,
  buildTemplateTeamField,
  defaultTeamFromOwner,
  getPossibleTeamsForAction,
  getTeamFieldState,
  NO_TEAM_LABEL,
  NO_TEAM_SENTINEL,
  resolveTeamId,
} from './template-team-field';

const blue = {_id: 'blue', name: 'Blue'};
const red = {_id: 'red', name: 'Red'};

function optionValues(field: {options?: {value: string}[]}) {
  return field.options?.map(option => option.value) ?? [];
}

describe('buildTeamField (survey/template create)', () => {
  it('requires a team for both global and in-team creators', () => {
    for (const canCreateGlobally of [true, false]) {
      const field = buildTeamField({
        canCreateGlobally,
        possibleTeams: [blue, red],
        label: 'Team',
      });
      expect(field.schema.safeParse(undefined).success).toBe(false);
      expect(field.schema.safeParse(blue._id).success).toBe(true);
      expect(field.clearable).toBe(false);
    }
  });

  it('includes a No team option only when canCreateGlobally', () => {
    const globalField = buildTeamField({
      canCreateGlobally: true,
      possibleTeams: [blue, red],
      label: 'Team',
    });
    expect(optionValues(globalField)).toEqual([
      NO_TEAM_SENTINEL,
      blue._id,
      red._id,
    ]);
    expect(globalField.options?.[0]).toEqual({
      label: NO_TEAM_LABEL,
      value: NO_TEAM_SENTINEL,
    });

    const inTeamField = buildTeamField({
      canCreateGlobally: false,
      possibleTeams: [blue, red],
      label: 'Team',
    });
    expect(optionValues(inTeamField)).toEqual([blue._id, red._id]);
    expect(optionValues(inTeamField)).not.toContain(NO_TEAM_SENTINEL);
  });

  it('shows only No team when a global creator has no eligible teams', () => {
    const field = buildTeamField({
      canCreateGlobally: true,
      possibleTeams: [],
      label: 'Team',
    });
    expect(field.options).toEqual([
      {label: NO_TEAM_LABEL, value: NO_TEAM_SENTINEL},
    ]);
    expect(field.schema.safeParse(undefined).success).toBe(false);
    expect(field.schema.safeParse(NO_TEAM_SENTINEL).success).toBe(true);
  });
});

describe('buildTemplateTeamField copy', () => {
  it('does not mark the field optional or tell the user to leave it blank', () => {
    const field = buildTemplateTeamField({
      canCreateGlobally: true,
      possibleTeams: [blue],
    });
    expect(field.label).toBe('Team');
    expect(field.label).not.toMatch(/optional/i);
    expect(field.description).toMatch(/No team/);
    expect(field.description).not.toMatch(/leave blank/i);
    expect(field.description).not.toMatch(/clear/i);
  });
});

describe('buildTeamField (map-layer optional blank)', () => {
  it('requires a team when the user cannot create outside a team', () => {
    const field = buildTeamField({
      canCreateGlobally: false,
      possibleTeams: [blue, red],
      label: 'Team',
      allowBlank: true,
    });
    expect(field.clearable).toBe(false);
    expect(field.schema.safeParse(undefined).success).toBe(false);
    expect(field.schema.safeParse(blue._id).success).toBe(true);
    expect(optionValues(field)).not.toContain(NO_TEAM_SENTINEL);
  });

  it('lets a Super User leave team blank', () => {
    const field = buildTeamField({
      canCreateGlobally: true,
      possibleTeams: [blue, red],
      label: 'Team (optional)',
      allowBlank: true,
    });
    expect(field.clearable).toBe(true);
    expect(field.schema.safeParse(undefined).success).toBe(true);
    expect(optionValues(field)).toEqual([blue._id, red._id]);
  });
});

describe('getPossibleTeamsForAction', () => {
  it('lists only teams the user can create in', () => {
    const teams = getPossibleTeamsForAction({
      teams: [blue, red],
      canCreateGlobally: false,
      createInTeamAction: Action.CREATE_PROJECT_IN_TEAM,
      decodedToken: {
        globalRoles: [Role.GENERAL_USER],
        resourceRoles: [{resourceId: blue._id, role: Role.TEAM_MANAGER}],
      },
    });
    expect(teams).toEqual([blue]);
  });

  it('lists every visible team for a global creator', () => {
    const teams = getPossibleTeamsForAction({
      teams: [blue, red],
      canCreateGlobally: true,
      createInTeamAction: Action.CREATE_PROJECT_IN_TEAM,
      decodedToken: {
        globalRoles: [Role.GENERAL_CREATOR],
        resourceRoles: [],
      },
    });
    expect(teams).toEqual([blue, red]);
  });

  it('lists only teams the user can upload a map layer into', () => {
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
});

describe('getTeamFieldState', () => {
  it('shows a dropdown for a global creator with zero teams', () => {
    const {showTeamCallout, showTeamDropdown} = getTeamFieldState({
      canCreateGlobally: true,
      possibleTeams: [],
    });
    expect(showTeamCallout).toBe(false);
    expect(showTeamDropdown).toBe(true);
  });

  it('hides the dropdown when specifiedTeam is set', () => {
    const {showTeamCallout, showTeamDropdown} = getTeamFieldState({
      canCreateGlobally: true,
      specifiedTeam: blue._id,
      possibleTeams: [blue, red],
    });
    expect(showTeamCallout).toBe(false);
    expect(showTeamDropdown).toBe(false);
  });

  it('uses the callout for one in-team-only team', () => {
    const {showTeamCallout, showTeamDropdown} = getTeamFieldState({
      canCreateGlobally: false,
      possibleTeams: [blue],
    });
    expect(showTeamCallout).toBe(true);
    expect(showTeamDropdown).toBe(false);
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

describe('resolveTeamId', () => {
  it('maps the No team sentinel to undefined', () => {
    expect(
      resolveTeamId({
        canCreateGlobally: true,
        possibleTeams: [blue, red],
        team: NO_TEAM_SENTINEL,
      })
    ).toBeUndefined();
  });

  it('passes a team id through', () => {
    expect(
      resolveTeamId({
        canCreateGlobally: true,
        possibleTeams: [blue, red],
        team: blue._id,
      })
    ).toBe(blue._id);
  });

  it('returns specifiedTeam first', () => {
    expect(
      resolveTeamId({
        canCreateGlobally: true,
        specifiedTeam: red._id,
        possibleTeams: [blue, red],
        team: NO_TEAM_SENTINEL,
      })
    ).toBe(red._id);
  });

  it('returns the single in-team option when there is no global create', () => {
    expect(
      resolveTeamId({
        canCreateGlobally: false,
        possibleTeams: [blue],
      })
    ).toBe(blue._id);
  });
});

describe('defaultTeamFromOwner', () => {
  it('defaults to the owner team id, not the No team sentinel', () => {
    expect(
      defaultTeamFromOwner({
        ownerTeamId: blue._id,
        possibleTeams: [blue, red],
      })
    ).toBe(blue._id);
    expect(
      defaultTeamFromOwner({
        ownerTeamId: blue._id,
        possibleTeams: [blue, red],
      })
    ).not.toBe(NO_TEAM_SENTINEL);
  });
});
