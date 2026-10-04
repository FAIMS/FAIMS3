// SPDX-License-Identifier: Apache-2.0
/* eslint-disable n/no-unsupported-features/node-builtins */
import {Browser} from '@capacitor/browser';
import {config, IS_WEB_PLATFORM} from '../../../buildconfig';

/** Where Conductor should send the browser after login. */
export function authReturnRedirect({
  isWebPlatform = IS_WEB_PLATFORM,
  appId = config.appId,
  location = window.location,
}: {
  isWebPlatform?: boolean;
  appId?: string;
  location?: Pick<Location, 'protocol' | 'host'>;
} = {}): string {
  return isWebPlatform
    ? `${location.protocol}//${location.host}/auth-return`
    : `${appId}://auth-return`;
}

/**
 * Build a Conductor `/login` URL that returns to the app after auth.
 * Local-login re-auth may include `email` so the form can be prefilled.
 */
export function conductorLoginUrl({
  conductorUrl,
  redirect,
  email,
}: {
  conductorUrl: string;
  redirect: string;
  email?: string;
}): string {
  const url = new URL(`${conductorUrl.replace(/\/$/, '')}/login`);
  url.searchParams.set('redirect', redirect);
  const identifier = email?.trim();
  if (identifier) {
    url.searchParams.set('email', identifier);
  }
  return url.toString();
}

/** Open Conductor login in this window (web) or the system browser (native). */
export async function openConductorLogin({
  conductorUrl,
  email,
}: {
  conductorUrl: string;
  email?: string;
}): Promise<void> {
  const url = conductorLoginUrl({
    conductorUrl,
    redirect: authReturnRedirect(),
    email,
  });
  if (IS_WEB_PLATFORM) {
    window.location.href = url;
  } else {
    await Browser.open({url});
  }
}
