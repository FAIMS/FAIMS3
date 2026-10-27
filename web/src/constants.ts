// SPDX-License-Identifier: Apache-2.0
import {parseWebEnv} from '@faims3/build-config';
import {
  INVITE_EXPIRY_HINT_DAYS,
  Resource,
  resourceRoles,
} from '@faims3/data-model';
import type {MapConfig} from '@faims3/forms';

/*
 * Configuration is parsed from Vite's `import.meta.env` via
 * `@faims3/build-config` (`parseWebEnv`). This module filters team roles
 * and attaches a few hardcoded Control Centre constants.
 *
 * The `config` singleton is the source of truth. Prefer importing `{config}`
 * and reading `config.<field>`.
 */

/** Token refresh interval for the Control Centre session (3 minutes). */
const DEFAULT_REFRESH_INTERVAL_MS = 3 * 60 * 1000;
/** Docs link for long-lived token help UI (not currently env-configurable). */
const DEFAULT_LONG_LIVED_TOKEN_HELP_LINK =
  'https://github.com/FAIMS/FAIMS3/blob/main/docs/developer/docs/source/markdown/Long-lived-tokens.md';

/**
 * When the directory lists a notebook as archived (or id absent), the mobile app
 * may drop local DBs after sync (`allow`) or keep them closed but recoverable (`never`).
 */
export type ForceRemoteDeletionMode = 'allow' | 'never';

/**
 * `excludedTeamRoles` arrives as a plain list from the shared config. The
 * Control Centre additionally ignores any value that is not a valid TEAM role
 * (and warns), matching the previous behaviour.
 */
function filterValidTeamRoles(roles: string[]): string[] {
  const validTeamRoles = new Set(
    resourceRoles[Resource.TEAM].map(r => r.role as string)
  );
  const invalid = roles.filter(r => !validTeamRoles.has(r));
  if (invalid.length > 0) {
    console.warn(
      `excludedTeamRoles contains values that are not team roles and will be ignored: ${invalid.join(', ')}`
    );
  }
  return roles.filter(r => validTeamRoles.has(r));
}

/** Control Centre singleton. Prefer `import {config}` and `config.<field>`. */
const parsed = parseWebEnv(import.meta.env, {appVersion: __APP_VERSION__});

export const config = {
  ...parsed,
  excludedTeamRoles: new Set(filterValidTeamRoles(parsed.excludedTeamRoles)),
  /** Session token refresh interval (ms); currently hardcoded to 3 minutes. */
  refreshIntervalMs: DEFAULT_REFRESH_INTERVAL_MS,
  /**
   * Invite expiry duration chips. Capped at {@link INVITE_EXPIRY_HINT_DAYS}
   * (max 90 days).
   */
  inviteTokenHints: [...INVITE_EXPIRY_HINT_DAYS],
  /** Help-docs URL for long-lived tokens in the profile UI. */
  longLivedTokenHelpLink: DEFAULT_LONG_LIVED_TOKEN_HELP_LINK,
};

export type Config = typeof config;

/** Replace `{notebook}` / `{notebooks}` placeholders with the deployment's notebook name. */
export const brandNotebook = (text: string): string =>
  text
    .replaceAll('{notebooks}', config.notebookNamePlural)
    .replaceAll('{notebook}', config.notebookName);

/**
 * Builds a suitable register URL which will redirect back to the targeted
 * location - requires an invite
 */
export function buildRegisterUrl({
  redirect,
  inviteId,
}: {
  redirect: string;
  inviteId: string;
}) {
  return `${config.apiUrl}/register?redirect=${redirect}&inviteId=${inviteId}`;
}

/**
 * Map config factory for form managers that expect `() => MapConfig`
 * (see `@faims3/forms` PreviewFormManager). Prefer `config.mapConfig` when a
 * plain object is enough.
 */
export function getMapConfig(): MapConfig {
  return config.mapConfig;
}
