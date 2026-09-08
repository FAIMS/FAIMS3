/**
 * Browser-only download-grant cookie. The secret never appears in the URL.
 * Headless clients ignore this cookie and use Authorization: Bearer instead.
 */

import {Response} from 'express';
import {config} from './buildconfig';
import {DOWNLOAD_GRANT_EXPIRY_MS} from './couchdb/downloadGrants';

export const DOWNLOAD_COOKIE_NAME = 'faims_download';
export const DOWNLOAD_COOKIE_SECURE_NAME = '__Secure-faims_download';
export const DOWNLOAD_COOKIE_PATH = '/api/notebooks/download';

/** True when the request arrived over HTTPS (or a proxy advertised it). */
export const isRequestHttps = (req: {
  secure?: boolean;
  get?: (name: string) => string | undefined;
}): boolean => req.secure === true || req.get?.('x-forwarded-proto') === 'https';

/** Cookie name: `__Secure-` prefix is required when the cookie is Secure. */
export const downloadCookieName = (secure: boolean): string =>
  secure ? DOWNLOAD_COOKIE_SECURE_NAME : DOWNLOAD_COOKIE_NAME;

/** Split a `Cookie` header into name → value. Values stay URL-decoded. */
const parseCookieHeader = (
  header: string | undefined
): Record<string, string> => {
  const out: Record<string, string> = {};
  if (!header) {
    return out;
  }
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) {
      continue;
    }
    const key = part.slice(0, idx).trim();
    const raw = part.slice(idx + 1).trim();
    if (!key) {
      continue;
    }
    try {
      out[key] = decodeURIComponent(raw);
    } catch {
      out[key] = raw;
    }
  }
  return out;
};

export type ParsedDownloadCookie = {
  grantId: string;
  secret: string;
};

/** Parse `grantId.secret` from a cookie value. Returns null if malformed. */
export const parseDownloadGrantCookieValue = (
  value: string | undefined
): ParsedDownloadCookie | null => {
  if (!value) {
    return null;
  }
  const sep = value.indexOf('.');
  if (sep <= 0 || sep === value.length - 1) {
    return null;
  }
  return {
    grantId: value.slice(0, sep),
    secret: value.slice(sep + 1),
  };
};

/**
 * Read the download-grant cookie from a request. Prefers the `__Secure-`
 * name when both are present.
 */
export const readDownloadGrantCookie = (req: {
  get?: (name: string) => string | undefined;
}): ParsedDownloadCookie | null => {
  const cookies = parseCookieHeader(req.get?.('cookie'));
  const raw =
    cookies[DOWNLOAD_COOKIE_SECURE_NAME] ?? cookies[DOWNLOAD_COOKIE_NAME];
  return parseDownloadGrantCookieValue(raw);
};

/** HttpOnly cookie options scoped to the download path. */
const cookieOptions = (secure: boolean) => {
  const sameSite = config.downloadCookieSameSite;
  return {
    httpOnly: true,
    // SameSite=None requires Secure.
    secure: sameSite === 'none' ? true : secure,
    sameSite,
    path: DOWNLOAD_COOKIE_PATH,
    maxAge: DOWNLOAD_GRANT_EXPIRY_MS,
  };
};

/**
 * Set the download-grant cookie (`grantId.secret`) so Control Centre can
 * `window.open` the redeem URL without putting the secret in the query.
 */
export const setDownloadGrantCookie = ({
  res,
  grantId,
  secret,
  secure,
}: {
  res: Response;
  grantId: string;
  secret: string;
  secure: boolean;
}): void => {
  res.cookie(
    downloadCookieName(secure),
    `${grantId}.${secret}`,
    cookieOptions(secure)
  );
};

/**
 * Clear both cookie name variants so a leftover Secure/non-Secure cookie
 * cannot redeem after a successful consume.
 */
/**
 * Shared caches must not store mint or redeem responses. The grant id is in
 * the URL; without these headers a proxy keyed only on that URL can serve
 * an export after a legitimate redeem with no cookie or Bearer.
 */
export const setDownloadNoStoreHeaders = (res: Response): void => {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Vary', 'Authorization, Cookie');
};

export const clearDownloadGrantCookie = ({
  res,
  secure,
}: {
  res: Response;
  secure: boolean;
}): void => {
  const names = secure
    ? [DOWNLOAD_COOKIE_SECURE_NAME, DOWNLOAD_COOKIE_NAME]
    : [DOWNLOAD_COOKIE_NAME, DOWNLOAD_COOKIE_SECURE_NAME];
  for (const name of names) {
    res.clearCookie(name, {
      httpOnly: true,
      secure: name.startsWith('__Secure-') || secure,
      sameSite: config.downloadCookieSameSite,
      path: DOWNLOAD_COOKIE_PATH,
    });
  }
};
