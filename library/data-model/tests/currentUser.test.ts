// SPDX-License-Identifier: Apache-2.0
import {GetCurrentUserResponseSchema, hasLocalLoginProfile} from '../src';

describe('GetCurrentUserResponseSchema hasLocalProfile', () => {
  const base = {
    id: 'user-1',
    name: 'Ada',
    email: 'ada@example.com',
    isVerified: true,
  };

  it('parses payloads that omit the optional field', () => {
    const parsed = GetCurrentUserResponseSchema.parse(base);
    expect(parsed.hasLocalProfile).toBeUndefined();
    expect(hasLocalLoginProfile(parsed.hasLocalProfile)).toBe(false);
  });

  it('treats only explicit true as a local login profile', () => {
    expect(hasLocalLoginProfile(undefined)).toBe(false);
    expect(hasLocalLoginProfile(false)).toBe(false);
    expect(hasLocalLoginProfile(true)).toBe(true);
    expect(
      GetCurrentUserResponseSchema.parse({...base, hasLocalProfile: true})
        .hasLocalProfile
    ).toBe(true);
  });
});
