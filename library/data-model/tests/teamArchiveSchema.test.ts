// SPDX-License-Identifier: Apache-2.0
import {PutArchiveTeamRequestSchema, TeamDocumentSchema} from '../src/api';

const activeTeam = {
  _id: 'team_1',
  _rev: '1-abc',
  name: 'Field team',
  description: 'A team',
  createdAt: 1,
  updatedAt: 2,
  createdBy: 'admin',
};

describe('Team archive Zod schemas', () => {
  it('accepts team documents without archived (treat as active)', () => {
    const parsed = TeamDocumentSchema.parse(activeTeam);
    expect(parsed.archived).toBeUndefined();
  });

  it('accepts archived true and false', () => {
    expect(
      TeamDocumentSchema.parse({...activeTeam, archived: true}).archived
    ).toBe(true);
    expect(
      TeamDocumentSchema.parse({...activeTeam, archived: false}).archived
    ).toBe(false);
  });

  it('requires a boolean archive on PutArchiveTeamRequestSchema', () => {
    expect(PutArchiveTeamRequestSchema.parse({archive: true})).toEqual({
      archive: true,
    });
    expect(PutArchiveTeamRequestSchema.parse({archive: false})).toEqual({
      archive: false,
    });
    expect(PutArchiveTeamRequestSchema.safeParse({}).success).toBe(false);
    expect(
      PutArchiveTeamRequestSchema.safeParse({archive: 'true'}).success
    ).toBe(false);
  });
});
