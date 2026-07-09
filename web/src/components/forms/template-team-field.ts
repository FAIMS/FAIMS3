/**
 * Shared team-selection helpers for create flows (templates, projects from
 * templates, etc.).
 *
 * The API distinguishes global create (`CREATE_*`) from in-team create
 * (`CREATE_*_IN_TEAM`). These helpers pick the correct UI (callout vs optional
 * dropdown) and resolve the `teamId` sent on submit.
 */
import type {Field} from '@/components/form';
import {
  Action,
  getUserResourcesForAction,
  type DecodedTokenPermissions,
} from '@faims3/data-model';
import {z} from 'zod';

/** Minimal team shape from GET /api/teams. */
export type TeamOption = {_id: string; name: string};

/**
 * Teams the user may assign when creating a resource.
 *
 * Global creators see every visible team; team-scoped creators only see teams
 * where their token grants the relevant `CREATE_*_IN_TEAM` action.
 */
export function getPossibleTeamsForAction({
  teams,
  canCreateGlobally,
  createInTeamAction,
  decodedToken,
}: {
  teams?: TeamOption[];
  canCreateGlobally: boolean;
  createInTeamAction:
    | Action.CREATE_TEMPLATE_IN_TEAM
    | Action.CREATE_PROJECT_IN_TEAM;
  decodedToken?: DecodedTokenPermissions | null;
}): TeamOption[] {
  const teamsAvailable =
    (canCreateGlobally
      ? teams?.map(t => t._id)
      : getUserResourcesForAction({
          decodedToken: decodedToken ?? {
            globalRoles: [],
            resourceRoles: [],
          },
          action: createInTeamAction,
        })) || [];

  return teams?.filter(team => teamsAvailable.includes(team._id)) ?? [];
}

/**
 * Whether to show a fixed team callout or an interactive team dropdown.
 *
 * - Callout: user must create in a team and has exactly one choice (no global
 *   create permission, team not fixed by route context).
 * - Dropdown: user can pick among teams and/or leave blank when global create
 *   is allowed. Omitted entirely when `specifiedTeam` fixes the team (e.g. team
 *   tab) or when there are no eligible teams.
 */
export function getTeamFieldState({
  canCreateGlobally,
  specifiedTeam,
  possibleTeams,
}: {
  canCreateGlobally: boolean;
  specifiedTeam?: string;
  possibleTeams: TeamOption[];
}) {
  const showTeamCallout =
    !canCreateGlobally && !specifiedTeam && possibleTeams.length === 1;

  const showTeamDropdown =
    !specifiedTeam &&
    possibleTeams.length > 0 &&
    (canCreateGlobally || possibleTeams.length > 1);

  return {showTeamCallout, showTeamDropdown};
}

/** @deprecated Prefer {@link getTeamFieldState}. */
export const getTemplateTeamFieldState = getTeamFieldState;

/**
 * Resolves the team id for a create request from form values and permissions.
 *
 * Priority: route-fixed team → auto-assign when only one in-team option → form
 * field value (may be undefined for global create).
 */
export function resolveTeamId({
  canCreateGlobally,
  specifiedTeam,
  possibleTeams,
  team,
}: {
  canCreateGlobally: boolean;
  specifiedTeam?: string;
  possibleTeams: TeamOption[];
  team?: string;
}): string | undefined {
  if (specifiedTeam) {
    return specifiedTeam;
  }
  if (!canCreateGlobally && possibleTeams.length === 1) {
    return possibleTeams[0]._id;
  }
  return team || undefined;
}

/** @deprecated Prefer {@link resolveTeamId}. */
export const resolveTemplateTeamId = resolveTeamId;

/**
 * Suggested default team when creating from an existing owned resource (e.g.
 * project from template).
 *
 * Returns the owner team id only when the user is allowed to create in that
 * team; otherwise undefined so the form starts with no selection.
 */
export function defaultTeamFromOwner({
  ownerTeamId,
  possibleTeams,
}: {
  ownerTeamId?: string;
  possibleTeams: TeamOption[];
}): string | undefined {
  if (!ownerTeamId) {
    return undefined;
  }
  return possibleTeams.some(t => t._id === ownerTeamId)
    ? ownerTeamId
    : undefined;
}

/**
 * Builds a {@link Field} definition for an optional or required team select.
 *
 * When `canCreateGlobally` is true the field is optional and clearable so the
 * user can create outside any team.
 */
export function buildTeamField({
  canCreateGlobally,
  possibleTeams,
  label,
  description,
}: {
  canCreateGlobally: boolean;
  possibleTeams: TeamOption[];
  label: string;
  description?: string;
}): Field {
  return {
    name: 'team',
    label,
    description,
    options: possibleTeams.map(({_id, name}) => ({
      label: name,
      value: _id,
    })),
    schema: canCreateGlobally ? z.string().optional() : z.string(),
    clearable: canCreateGlobally,
  };
}

/** Team field preset for the create-template dialog copy. */
export function buildTemplateTeamField({
  canCreateGlobally,
  possibleTeams,
}: {
  canCreateGlobally: boolean;
  possibleTeams: TeamOption[];
}): Field {
  return buildTeamField({
    canCreateGlobally,
    possibleTeams,
    label: `Team${canCreateGlobally ? ' (optional)' : ''}`,
    description: canCreateGlobally
      ? 'Choose a team to own this template, or leave blank to create outside any team.'
      : undefined,
  });
}
