// SPDX-License-Identifier: Apache-2.0
import {hasLocalLoginProfile} from '@faims3/data-model';
import {config} from '@/constants';

const RELOGIN_EMAIL_KEY = 'faims.reloginEmail';

/**
 * Login identifier to carry to Conductor after a local session expires.
 * SSO-only accounts (OIDC/SAML/Google, …) return undefined so the email is
 * never put on the login URL.
 */
export function loginIdentifierFromUser(
  user:
    | {
        email?: string;
        hasLocalProfile?: boolean;
      }
    | null
    | undefined
): string | undefined {
  if (!user || !hasLocalLoginProfile(user.hasLocalProfile)) return undefined;
  const identifier = user.email?.trim();
  return identifier || undefined;
}

/** Remember a local-login identifier across the session-expiry redirect. */
export function stashReloginEmail(email?: string | null) {
  if (email && email.length > 0) {
    sessionStorage.setItem(RELOGIN_EMAIL_KEY, email);
  } else {
    sessionStorage.removeItem(RELOGIN_EMAIL_KEY);
  }
}

/** Read a previously stashed local-login identifier, if any. */
export function peekReloginEmail(): string | undefined {
  return sessionStorage.getItem(RELOGIN_EMAIL_KEY) ?? undefined;
}

/** Drop any stashed local-login identifier after a successful sign-in. */
export function clearReloginEmail() {
  sessionStorage.removeItem(RELOGIN_EMAIL_KEY);
}

/**
 * Conductor login URL that redirects back here. When `email` is a local-login
 * identifier it is added as `?email=` for the login form to prefill and strip.
 */
export function buildSigninPath(email?: string | null): string {
  const trimmed = email?.trim();
  if (!trimmed) return config.signinPath;
  try {
    const url = new URL(config.signinPath);
    url.searchParams.set('email', trimmed);
    return url.toString();
  } catch {
    const sep = config.signinPath.includes('?') ? '&' : '?';
    return `${config.signinPath}${sep}email=${encodeURIComponent(trimmed)}`;
  }
}

/** Sign-in URL for an expired session: local users only get `?email=`. */
export function signinPathForExpiredSession(
  user:
    | {
        email?: string;
        hasLocalProfile?: boolean;
      }
    | null
    | undefined
): string {
  return buildSigninPath(loginIdentifierFromUser(user) ?? peekReloginEmail());
}
