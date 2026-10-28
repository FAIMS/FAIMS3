// SPDX-License-Identifier: Apache-2.0

import {COUCHDB_ROLES_PATH} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import {parseToken} from './users';

function jwtWithClaim(hasLocalProfile?: boolean): string {
  const payload: Record<string, unknown> = {
    sub: 'ada',
    exp: Math.floor(Date.now() / 1000) + 3600,
    server: 'https://conductor.example',
    name: 'Ada Lovelace',
    [COUCHDB_ROLES_PATH]: [],
    resourceRoles: [],
    globalRoles: [],
  };
  if (hasLocalProfile !== undefined) {
    payload.hasLocalProfile = hasLocalProfile;
  }
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({alg: 'none', typ: 'JWT'})}.${encode(payload)}.`;
}

describe('parseToken hasLocalProfile', () => {
  it('maps an explicit true claim through hasLocalLoginProfile', () => {
    expect(parseToken(jwtWithClaim(true)).hasLocalProfile).toBe(true);
  });

  it('maps an explicit false claim to false', () => {
    expect(parseToken(jwtWithClaim(false)).hasLocalProfile).toBe(false);
  });

  it('treats an omitted claim as false', () => {
    expect(parseToken(jwtWithClaim()).hasLocalProfile).toBe(false);
  });
});
