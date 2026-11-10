// SPDX-License-Identifier: Apache-2.0
/**
 * Shared team-selection helpers for create and reassign flows (templates,
 * projects from templates, assign-to-team dialogs, etc.).
 *
 * The API distinguishes global create (`CREATE_*`) from in-team create
 * (`CREATE_*_IN_TEAM`). These helpers pick the correct UI (callout vs required
 * dropdown with a permission-gated "No team" option) and resolve the `teamId`
 * sent on submit. Reassign dialogs reuse the same "No team" sentinel when the
 * user has `REMOVE_*_FROM_TEAM` on the resource.
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
 * Form value meaning “create outside any team”. Radix Select rejects `""`, so
 * this non-empty sentinel is used in the UI and mapped to omitted `teamId` by
 * {@link resolveTeamId}. Never send this string to the API.
 */
export const NO_TEAM_SENTINEL = '__no_team__';

/** Visible label for {@link NO_TEAM_SENTINEL}. */
export const NO_TEAM_LABEL = 'No team';

/** Stable selector for the team select built by {@link buildTeamField}. */
export const TEAM_FIELD_TEST_ID = 'web-create-team';

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
    | Action.CREATE_PROJECT_IN_TEAM
    | Action.CREATE_MAP_ASSET_IN_TEAM;
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
 * - Dropdown: user can pick among teams, and (when global create is allowed)
 *   an explicit "No team" option. Shown for global creators even with zero
 *   eligible teams (only "No team"). Omitted when `specifiedTeam` fixes the
 *   team (e.g. team tab).
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
    !specifiedTeam && (canCreateGlobally || possibleTeams.length > 1);

  return {showTeamCallout, showTeamDropdown};
}

/** @deprecated Prefer {@link getTeamFieldState}. */
export const getTemplateTeamFieldState = getTeamFieldState;

/**
 * Resolves the team id for a create request from form values and permissions.
 *
 * Priority: route-fixed team → auto-assign when only one in-team option → form
 * field value (`NO_TEAM_SENTINEL` maps to undefined / omitted `teamId`).
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
  if (team === NO_TEAM_SENTINEL) {
    return undefined;
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
 * Default value for the assign-to-team select.
 *
 * Prefills the current owner when that team is in the dropdown. If the
 * resource has no team and the user may unassign (`REMOVE_*_FROM_TEAM`), uses
 * {@link NO_TEAM_SENTINEL} so the field shows "No team" instead of a
 * placeholder.
 */
export function defaultTeamForReassign({
  ownerTeamId,
  possibleTeams,
  canUnassign,
}: {
  ownerTeamId?: string;
  possibleTeams: TeamOption[];
  canUnassign: boolean;
}): string | undefined {
  if (ownerTeamId && possibleTeams.some(t => t._id === ownerTeamId)) {
    return ownerTeamId;
  }
  if (!ownerTeamId && canUnassign) {
    return NO_TEAM_SENTINEL;
  }
  return undefined;
}

/**
 * Builds a {@link Field} definition for a team select.
 *
 * When `includeNoTeam` is true (defaults to `canCreateGlobally`) and
 * `allowBlank` is false, the options include {@link NO_TEAM_LABEL} (sentinel
 * {@link NO_TEAM_SENTINEL}). The schema still requires a choice — pick a team
 * or "No team". Map-layer upload sets `allowBlank` so Super Users may leave
 * the field empty instead. Assign dialogs pass `includeNoTeam` from
 * `REMOVE_*_FROM_TEAM`.
 *
 * Callers always pass {@link description} so the selector has help text
 * whether or not the user may create outside a team. Optionality is spelled
 * out in that help text, not in the label.
 */
export function buildTeamField({
  canCreateGlobally,
  possibleTeams,
  label,
  description,
  allowBlank = false,
  includeNoTeam = canCreateGlobally,
}: {
  canCreateGlobally: boolean;
  possibleTeams: TeamOption[];
  label: string;
  description: string;
  /**
   * When true (map-layer upload), global creators may leave the field blank
   * and clear it. Survey/template create uses the default: a required select
   * with a "No team" sentinel when the user can create unowned.
   */
  allowBlank?: boolean;
  /**
   * Show the "No team" sentinel. Defaults to {@link canCreateGlobally}. Assign
   * dialogs set this from `REMOVE_*_FROM_TEAM` instead of create permission.
   */
  includeNoTeam?: boolean;
}): Field {
  const teamOptions = possibleTeams.map(({_id, name}) => ({
    label: name,
    value: _id,
  }));
  const options =
    includeNoTeam && !allowBlank
      ? [{label: NO_TEAM_LABEL, value: NO_TEAM_SENTINEL}, ...teamOptions]
      : teamOptions;

  return {
    name: 'team',
    label,
    description,
    options,
    schema:
      allowBlank && canCreateGlobally ? z.string().optional() : z.string(),
    clearable: allowBlank && canCreateGlobally,
    testId: TEAM_FIELD_TEST_ID,
    placeholder: 'Select a team',
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
    label: 'Team',
    description: canCreateGlobally
      ? 'Choose a team to own this template, or select "No team".'
      : 'Choose a team to own this template.',
  });
}
