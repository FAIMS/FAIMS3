// SPDX-License-Identifier: Apache-2.0
import {parseGeneratedEnv} from '@faims3/build-config';
import {
  INVITE_EXPIRY_HINT_DAYS,
  Resource,
  resourceRoles,
} from '@faims3/data-model';
import type {MapConfig} from '@faims3/forms';
import pluralize from 'pluralize';
import {capitalize} from './lib/utils';

/*
 * Configuration is parsed from Vite's `import.meta.env` via the shared
 * @faims3/build-config module (`parseGeneratedEnv`), which is the single
 * source of truth for the config chain. This module then layers on the
 * Control Centre's web-specific derived values (pluralised notebook names,
 * derived URLs, the aggregated map config, role filtering) and a few
 * build-time / hardcoded constants.
 *
 * The `config` singleton is the source of truth. Prefer importing `{config}`
 * and reading `config.<field>`. Dedicated exports remain only for genuine
 * helpers (e.g. brandNotebook, buildRegisterUrl, getMapConfig).
 *
 * Operational defaults and commented examples live in `web/.env.dist`.
 */

/** Token refresh interval for the Control Centre session (3 minutes). */
const DEFAULT_REFRESH_INTERVAL_MS = 3 * 60 * 1000;
/** Docs link for long-lived token help UI (not currently env-configurable). */
const DEFAULT_LONG_LIVED_TOKEN_HELP_LINK =
  'https://github.com/FAIMS/FAIMS3/blob/main/docs/developer/docs/source/markdown/Long-lived-tokens.md';

/**
 * When the directory lists a notebook as archived (or id absent), the mobile app
 * may drop local DBs after sync (`allow`) or keep them closed but recoverable (`never`).
 * Set via VITE_FORCE_REMOTE_DELETION; must match the Fieldmark app build for accurate web copy.
 */
export type ForceRemoteDeletionMode = 'allow' | 'never';

// ---------------------------------------------------------------------------
// Web-only derived / validation helpers (kept local, not env coercion).
// ---------------------------------------------------------------------------

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

/** The canonical config, parsed from the generated env by the shared module. */
const canonical = parseGeneratedEnv(import.meta.env);

// Every env-backed field has a default in the shared schema, so it is always
// populated at runtime. The module's inferred type is intentionally loose
// (`T | undefined`) to also describe partial inputs, so this helper narrows a
// guaranteed-present value to its concrete type for the Control Centre config.
const defined = <T,>(value: T | undefined): T => value as T;

const notebookName = defined(canonical.notebookAndRecordUX.notebookName);
const notebookNamePlural = pluralize(notebookName);

// Build-time version inject via Vite `define` (__APP_VERSION__ from
// package.json at build time — not an import.meta.env key).
let appVersion = 'unknown';
if (__APP_VERSION__) {
  console.info(`Using APP_VERSION from build: ${__APP_VERSION__}`);
  appVersion = __APP_VERSION__;
} else {
  console.warn('__APP_VERSION__ not set in build. Using "unknown"');
}

export const config = {
  // Env-backed values, sourced from the shared canonical config.
  notebookName,
  websiteTitle: defined(canonical.branding.websiteTitle),
  docsUrl: defined(canonical.support.docsUrl),
  theme: defined(canonical.branding.theme),
  developerMode: defined(canonical.dev.developerMode),
  forceRemoteDeletion: defined(canonical.sync.forceRemoteDeletion),
  deleteOnDeactivation: defined(canonical.sync.deleteOnDeactivation),
  // The shared model uses the 'unlimited' sentinel for no cap; the Control
  // Centre expects `undefined` to mean "no maximum".
  maximumLongLivedDurationDays:
    canonical.authTokens.maximumLongLivedDurationDays === 'unlimited'
      ? undefined
      : canonical.authTokens.maximumLongLivedDurationDays,
  mapSource: defined(canonical.maps.mapSource),
  mapSourceKey: defined(canonical.maps.mapSourceKey),
  mapStyle: defined(canonical.maps.mapStyle),
  satelliteSource: canonical.maps.satelliteSource,
  bugsnagApiKey: canonical.observability.bugsnagApiKey,
  appName: defined(canonical.branding.appName),
  appShortName: defined(
    canonical.branding.appShortName ?? canonical.branding.appName
  ),
  webUrl: defined(canonical.endpoints.webUrl),
  apiUrl: defined(canonical.endpoints.apiUrl),
  appUrl: defined(canonical.endpoints.appUrl),
  excludedTeamRoles: new Set(
    filterValidTeamRoles(defined(canonical.teamAndRolePolicy.excludedTeamRoles))
  ),
  maxDesignFileSizeMb: defined(canonical.webDesignerLimits.maxDesignFileSizeMb),
  maxDesignFileSizeBytes:
    defined(canonical.webDesignerLimits.maxDesignFileSizeMb) * 1024 * 1024,
  longLivedTokenDurationHints: defined(
    canonical.authTokens.longLivedTokenDurationHints
  ),

  // Derived / cross-field (no dedicated env key).
  /** Control Centre home (`webUrl` with trailing slash; `/` → `/teams`). */
  webHomeUrl: `${defined(canonical.endpoints.webUrl).replace(/\/$/, '')}/`,
  notebookNameCapitalized: capitalize(notebookName),
  notebookNamePlural,
  notebookNamePluralCapitalized: capitalize(notebookNamePlural),
  /** Conductor login URL that redirects back to this Control Centre. */
  signinPath: `${defined(canonical.endpoints.apiUrl)}/login?redirect=${defined(canonical.endpoints.webUrl)}`,
  /** Fieldmark auth-return URL that accepts a `?token` query string. */
  appTokenReturnPath: `${defined(canonical.endpoints.appUrl)}/auth-return`,
  /** Aggregated map settings for map UI / form preview components. */
  mapConfig: {
    mapSource: defined(canonical.maps.mapSource),
    mapSourceKey: defined(canonical.maps.mapSourceKey),
    mapStyle: defined(canonical.maps.mapStyle),
    satelliteSource: canonical.maps.satelliteSource,
  },

  // Build-time / hardcoded (not currently env-configurable).
  /** Session token refresh interval (ms); currently hardcoded to 3 minutes. */
  refreshIntervalMs: DEFAULT_REFRESH_INTERVAL_MS,
  /**
   * Invite expiry duration chips. Capped at {@link INVITE_EXPIRY_HINT_DAYS}
   * (max 90 days).
   */
  inviteTokenHints: [...INVITE_EXPIRY_HINT_DAYS],
  /** Help-docs URL for long-lived tokens in the profile UI. */
  longLivedTokenHelpLink: DEFAULT_LONG_LIVED_TOKEN_HELP_LINK,
  /**
   * Package version from Vite `define` (`__APP_VERSION__` ← package.json).
   * Falls back to `'unknown'` when undefined.
   */
  appVersion,
};

export type Config = typeof config;

// ---------------------------------------------------------------------------
// Genuine helpers (not static config values). Prefer `config.<field>` for
// everything else.
// ---------------------------------------------------------------------------

/** Replace `{notebook}` / `{notebooks}` placeholders with the deployment's notebook name. */
export const brandNotebook = (text: string): string =>
  text
    .replaceAll('{notebooks}', config.notebookNamePlural)
    .replaceAll('{notebook}', config.notebookName);

/**
 * Builds a suitable register URL which will redirect back to the targeted
 * location - requires an invite
 * @returns The full address to redirect the window to
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
