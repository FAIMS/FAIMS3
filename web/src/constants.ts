// SPDX-License-Identifier: Apache-2.0
import {parseGeneratedEnv, RuntimeConfig} from '@faims3/build-config';
import type {MapConfig} from '@faims3/forms';

/**
 * When the directory lists a notebook as archived (or id absent), the mobile app
 * may drop local DBs after sync (`allow`) or keep them closed but recoverable (`never`).
 * Set via VITE_FORCE_REMOTE_DELETION; must match the Fieldmark app build for accurate web copy.
 */
export type ForceRemoteDeletionMode = 'allow' | 'never';

/**
 * Coerce the runtime configuration into the format that we use locally.
 * 
 * @param config The runtime configuration object.
 * @returns The web configuration object.
 */
function parseWebConfig(config: RuntimeConfig) {
  const notebookName = config.notebookAndRecordUX.notebookName;
  const appName = config.branding.appName;
  const webUrl = config.endpoints.webUrl;
  const apiUrl = config.endpoints.apiUrl;
  const appUrl = config.endpoints.appUrl;
  const websiteTitle = config.branding.websiteTitle;
  const maximumLongLivedDurationDays: number | undefined =
    config.authTokens.maximumLongLivedDurationDays === undefined ||
    config.authTokens.maximumLongLivedDurationDays === 'unlimited'
      ? undefined
      : Number(config.authTokens.maximumLongLivedDurationDays) || 90;
  const rawHints = config.authTokens.longLivedTokenDurationHints ?? [
    1, 5, 10, 30, 90, 365,
  ];
  const longLivedTokenDurationHints = [...new Set(rawHints)]
    .filter(
      hint =>
        maximumLongLivedDurationDays === undefined ||
        hint <= maximumLongLivedDurationDays
    )
    .sort((a, b) => a - b);
  const notebookNamePlural =
    notebookName.endsWith('s') ? `${notebookName}es` : `${notebookName}s`;
  const appVersion =
    typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__
      ? __APP_VERSION__
      : config.observability.commitVersion ?? 'unknown';

  return {
    notebookName,
    websiteTitle,
    docsUrl: config.support.docsUrl,
    appTheme: config.branding.theme,
    developerMode: config.dev.developerMode,
    forceRemoteDeletion: config.sync.forceRemoteDeletion,
    deleteOnDeactivation: config.sync.deleteOnDeactivation,
    maximumLongLivedDurationDays,
    mapSource: config.maps.mapSource,
    mapSourceKey: config.maps.mapSourceKey ?? '',
    mapStyle: config.maps.mapStyle,
    satelliteSource: config.maps.satelliteSource,
    bugsnagApiKey: config.observability.bugsnagApiKey,
    appName,
    webUrl,
    apiUrl,
    appUrl,
    excludedTeamRoles: new Set(config.teamAndRolePolicy.excludedTeamRoles),
    maxDesignFileSizeMb: config.webDesignerLimits.maxDesignFileSizeMb,
    maxDesignFileSizeBytes:
      config.webDesignerLimits.maxDesignFileSizeMb * 1024 * 1024,
    appShortName: config.branding.appShortName || appName,
    webHomeUrl: `${webUrl.replace(/\/$/, '')}/`,
    longLivedTokenDurationHints,
    notebookNameCapitalized:
      notebookName.charAt(0).toUpperCase() + notebookName.slice(1),
    notebookNamePlural,
    notebookNamePluralCapitalized:
      notebookNamePlural.charAt(0).toUpperCase() + notebookNamePlural.slice(1),
    signinPath: `${apiUrl}/login?redirect=${webUrl}`,
    appTokenReturnPath: `${appUrl}/auth-return`,
    mapConfig: {
      mapSource: config.maps.mapSource,
      mapSourceKey: config.maps.mapSourceKey ?? '',
      mapStyle: config.maps.mapStyle,
      satelliteSource: config.maps.satelliteSource,
    },
    refreshIntervalMs: config.authTokens.tokenRefreshIntervalMs ?? 180000,
    inviteTokenHints: [1, 5, 10, 30, 90],
    longLivedTokenHelpLink:
      'https://github.com/FAIMS/FAIMS3/blob/main/docs/developer/docs/source/markdown/Long-lived-tokens.md',
    appVersion,
  };
}

/**
 * The singleton Control Centre configuration object. Prefer reading values
 * from here (`config.<field>`). The canonical source is the shared config
 * package, which preserves the legacy flat shape for compatibility.
 */
export const config = parseWebConfig(parseGeneratedEnv(import.meta.env));

export type Config = typeof config;

/** Replace `{notebook}` / `{notebooks}` placeholders with the deployment's notebook name. */
export const brandNotebook = (text: string): string =>
  text
    .replaceAll('{notebooks}', config.notebookNamePlural)
    .replaceAll('{notebook}', config.notebookName);

/**
 * Builds a suitable register URL which will redirect back to the targeted
 * location - requires an invite.
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
 * Map config factory for form managers that expect `() => MapConfig`.
 */
export function getMapConfig(): MapConfig {
  return config.mapConfig;
}
