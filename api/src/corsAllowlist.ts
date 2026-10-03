/**
 * Browser CORS allowlist for Conductor. Requests with no Origin (curl,
 * scripts) are always allowed. Unknown browser origins get no CORS headers.
 */

import {config} from './buildconfig';

/** Android Capacitor WebView origin (`androidScheme` defaults to https). */
const CAPACITOR_ANDROID_ORIGIN = 'https://localhost';

/**
 * Default Capacitor / iOS `iosScheme` (the app id) when no custom scheme is
 * present on the app URLs or redirect whitelist.
 */
const DEFAULT_CAPACITOR_APP_ID = 'org.fedarch.faims3';

/** Optional overrides so unit tests can build a list without the live env. */
export type CorsAllowlistSources = {
  conductorPublicUrl?: string;
  webAppPublicUrl?: string;
  newConductorUrl?: string;
  androidAppUrl?: string;
  iosAppUrl?: string;
  redirectWhitelist?: readonly string[];
};

const isHttpProtocol = (protocol: string): boolean =>
  protocol === 'http:' || protocol === 'https:';

/** Parse an http(s) origin from a config URL; ignore custom app schemes. */
const httpOrigin = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  try {
    const parsed = new URL(value);
    if (isHttpProtocol(parsed.protocol)) {
      return parsed.origin;
    }
  } catch {
    // ignore invalid / non-URL entries (e.g. custom app schemes)
  }
  return undefined;
};

/**
 * Custom URL scheme (e.g. `org.fedarch.faims3`) from a non-http(s) URL.
 * `URL.origin` is `"null"` for these, so callers must build the origin.
 */
const appScheme = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  try {
    const parsed = new URL(value);
    if (!isHttpProtocol(parsed.protocol) && parsed.protocol.endsWith(':')) {
      return parsed.protocol.slice(0, -1);
    }
  } catch {
    // ignore invalid entries
  }
  return undefined;
};

const capacitorIosOrigin = (scheme: string): string => `${scheme}://localhost`;

const defaultSources = (): CorsAllowlistSources => ({
  conductorPublicUrl: config.conductorPublicUrl,
  webAppPublicUrl: config.webAppPublicUrl,
  newConductorUrl: config.newConductorUrl,
  androidAppUrl: config.androidAppUrl,
  iosAppUrl: config.iosAppUrl,
  redirectWhitelist: config.redirectWhitelist,
});

/**
 * Origins Conductor may CORS-allow: Conductor, the web app, the new
 * Conductor, http(s) entries from {@link config.redirectWhitelist}, the
 * Android Capacitor WebView (`https://localhost`), and iOS Capacitor
 * custom-scheme origins (`${appId}://localhost`) derived from app URL /
 * redirect-whitelist schemes when present.
 */
export const buildCorsAllowlist = (
  sources: CorsAllowlistSources = defaultSources()
): string[] => {
  const httpCandidates = [
    sources.conductorPublicUrl,
    sources.webAppPublicUrl,
    sources.newConductorUrl,
    ...(sources.redirectWhitelist ?? []),
  ];
  const origins = new Set<string>();
  for (const value of httpCandidates) {
    const origin = httpOrigin(value);
    if (origin) {
      origins.add(origin);
    }
  }

  // Capacitor Android WebView. Store links on androidAppUrl are not origins.
  origins.add(CAPACITOR_ANDROID_ORIGIN);

  const schemes = new Set<string>();
  for (const value of [
    sources.androidAppUrl,
    sources.iosAppUrl,
    ...(sources.redirectWhitelist ?? []),
  ]) {
    const scheme = appScheme(value);
    if (scheme) {
      schemes.add(scheme);
    }
  }
  if (schemes.size === 0) {
    schemes.add(DEFAULT_CAPACITOR_APP_ID);
  }
  for (const scheme of schemes) {
    origins.add(capacitorIosOrigin(scheme));
  }

  return [...origins];
};

/**
 * Whether a browser `Origin` is allowed. Missing Origin (curl, scripts) is
 * always allowed so non-browser clients are unaffected.
 */
export const isCorsOriginAllowed = (
  origin: string | undefined,
  allowlist: string[] = buildCorsAllowlist()
): boolean => {
  if (!origin) {
    return true;
  }
  return allowlist.includes(origin);
};
