// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: seedPaginationDataset.test.ts
 * Description:
 *   Runs the pagination fixture script against the in-memory databases and
 *   checks that every paginated list it is meant to fill finds its fixtures,
 *   and that a second run changes nothing.
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing

import {LIST_LIMIT_MAX} from '@faims3/data-model';
import request from 'supertest';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {app} from '../src/expressSetup';
import {adminToken, beforeApiTests} from './utils';

const COUNT = 3;
const FIRST_TEAM = 'team_bulk_001';
const FIRST_SURVEY = 'notebook_bulk_001';
const SCRIPT = '../src/scripts/seedPaginationDataset';

let runs = 0;

/**
 * Runs the script once. It is a module that seeds on import and then calls
 * `process.exit`, so each run imports it under a fresh query string and
 * waits for the (stubbed) exit.
 */
async function runSeed(): Promise<void> {
  const exit = vi
    .spyOn(process, 'exit')
    .mockImplementation((() => undefined) as never);
  runs += 1;
  await import(/* @vite-ignore */ `${SCRIPT}?run=${runs}`);
  await vi.waitFor(() => expect(exit).toHaveBeenCalled(), {
    timeout: 60_000,
    interval: 50,
  });
  expect(exit).toHaveBeenCalledWith(0);
  exit.mockRestore();
}

const numbered = (prefix: string) =>
  Array.from({length: COUNT}, (_, i) => `${prefix}00${i + 1}`);

/**
 * Sorted ids of one list, read as the admin through its paginated GET with
 * the largest page. The fixtures must all fit on that page.
 */
async function listIds(path: string, itemsKey: string): Promise<string[]> {
  const res = await request(app)
    .get(path)
    .query({limit: LIST_LIMIT_MAX})
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  expect(res.body.nextStartKey).toBeUndefined();
  return (res.body[itemsKey] as Array<{_id?: string; username?: string}>)
    .map(item => item._id ?? item.username ?? '')
    .sort();
}

/** What every list the fixtures fill returns. */
async function readFixtures() {
  return {
    teams: await listIds('/api/teams', 'teams'),
    templates: await listIds('/api/templates', 'templates'),
    surveys: await listIds('/api/notebooks', 'notebooks'),
    library: await listIds('/api/map-assets', 'assets'),
    teamLayers: await listIds(`/api/teams/${FIRST_TEAM}/map-assets`, 'assets'),
    surveyLayers: await listIds(
      `/api/map-assets?projectId=${FIRST_SURVEY}`,
      'assets'
    ),
    globalInvites: await listIds('/api/invites/global', 'invites'),
    teamInvites: await listIds(`/api/invites/team/${FIRST_TEAM}`, 'invites'),
    surveyInvites: await listIds(
      `/api/invites/notebook/${FIRST_SURVEY}`,
      'invites'
    ),
    firstTeamMembers: (
      await listIds(`/api/teams/${FIRST_TEAM}/members`, 'members')
    ).length,
    firstSurveyUsers: (
      await listIds(`/api/notebooks/${FIRST_SURVEY}/users`, 'users')
    ).length,
    otherTeamMembers: (
      await listIds('/api/teams/team_bulk_002/members', 'members')
    ).length,
  };
}

describe('seedPaginationDataset script', () => {
  beforeEach(async () => {
    await beforeApiTests();
    vi.stubEnv('BULK_SEED_COUNT', String(COUNT));
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('fills every paginated list, and a re-run leaves them unchanged', async () => {
    await runSeed();
    const seeded = await readFixtures();

    expect(seeded).toMatchObject({
      teams: numbered('team_bulk_'),
      library: numbered('asset-bulk-'),
      // The first team and survey hold every layer and invite, so their
      // tabs have more than one row per fixture number.
      teamLayers: numbered('asset-bulk-'),
      surveyLayers: numbered('asset-bulk-'),
      globalInvites: numbered('bulk-invite-global-'),
      teamInvites: numbered('bulk-invite-team-'),
      surveyInvites: numbered('bulk-invite-survey-'),
      firstTeamMembers: COUNT,
      firstSurveyUsers: COUNT,
      otherTeamMembers: 1,
    });
    expect(seeded.templates).toEqual(
      expect.arrayContaining(numbered('template_bulk_'))
    );
    expect(seeded.surveys).toEqual(
      expect.arrayContaining(numbered('notebook_bulk_'))
    );

    await runSeed();
    expect(await readFixtures()).toEqual(seeded);
  }, 120_000);
});
