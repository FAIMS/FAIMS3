/**
 * Browser CORS allowlist for Conductor. Requests with no Origin (curl,
 * scripts) are always allowed. Unknown browser origins get no CORS headers.
 */

import {config} from './buildconfig';

/** Parse an http(s) origin from a config URL; ignore custom app schemes. */
const httpOrigin = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
  } catch {
    // ignore invalid / non-URL entries (e.g. custom app schemes)
  }
  return undefined;
};

/**
 * Origins Conductor may CORS-allow: Conductor, the web app, the new
 * Conductor, and http(s) entries from {@link config.redirectWhitelist}.
 */
export const buildCorsAllowlist = (): string[] => {
  const candidates = [
    config.conductorPublicUrl,
    config.webAppPublicUrl,
    config.newConductorUrl,
    ...config.redirectWhitelist,
  ];
  const origins = new Set<string>();
  for (const value of candidates) {
    const origin = httpOrigin(value);
    if (origin) {
      origins.add(origin);
    }
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
