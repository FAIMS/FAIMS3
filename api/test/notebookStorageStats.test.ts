/*
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: notebookStorageStats.test.ts
 * Description:
 *   Tests for getUserProjectsDetailed's per-project byteCount, the team storage
 *   total it feeds, the N+1 info() fan-out over a team's notebooks, and the
 *   byteCount required-vs-optional schema contract.
 */
import {APINotebookListSchema} from '@faims3/data-model';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const getNanoDataDb = vi.hoisted(() => vi.fn());

vi.mock('../src/couchdb', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/couchdb')>();
  return {
    ...actual,
    getNanoDataDb,
  };
});

import {
  createNotebook,
  getUserProjectsDetailed,
} from '../src/couchdb/notebooks';
import {getExpressUserFromEmailOrUserId} from '../src/couchdb/users';
import {resetDatabases} from './mocks';
import {EMPTY_UI_SPECIFICATION} from './sampleNotebook';

describe('notebook storage stats', () => {
  /** Fake `sizes.active` (bytes) returned by the stubbed db info(), keyed by project id. */
  const byteCountByProject = new Map<string, number>();
  /** Project ids whose stubbed info() should reject, simulating a CouchDB lookup failure. */
  const erroringProjects = new Set<string>();
  /** Number of stubbed info() calls since the last reset; one per project the fan-out touches. */
  let infoCallCount = 0;

  beforeEach(async () => {
    await resetDatabases();
    byteCountByProject.clear();
    erroringProjects.clear();
    infoCallCount = 0;

    // Replace the real nano data DB (which would hit CouchDB) with a fake whose
    // info() returns the per-project size we seeded, so byteCount is deterministic.
    getNanoDataDb.mockImplementation(async (projectId: string) => {
      return {
        info: async () => {
          infoCallCount++;
          if (erroringProjects.has(projectId)) {
            throw new Error(
              `simulated CouchDB info() failure for ${projectId}`
            );
          }
          return {sizes: {active: byteCountByProject.get(projectId) ?? 0}};
        },
      } as any;
    });
  });

  afterEach(() => {
    getNanoDataDb.mockReset();
  });

  /** Create a notebook owned by `teamId` and register its fake stored byte size. */
  async function createTeamNotebook(
    name: string,
    teamId: string,
    bytes: number
  ): Promise<string> {
    const projectId = await createNotebook({
      projectName: name,
      uiSpecification: EMPTY_UI_SPECIFICATION,
      description: '',
      createdBy: 'admin',
      teamId,
    });
    if (!projectId) {
      throw new Error(`could not create test notebook ${name}`);
    }
    byteCountByProject.set(projectId, bytes);
    return projectId;
  }

  it('populates each project byteCount and the team total equals the sum of per-project counts', async () => {
    const admin = await getExpressUserFromEmailOrUserId('admin');
    if (!admin) {
      throw new Error('admin user missing');
    }

    const teamId = 'team-storage-sum';
    const sizes = {alpha: 100, beta: 250, gamma: 4096};
    const alphaId = await createTeamNotebook('Alpha', teamId, sizes.alpha);
    const betaId = await createTeamNotebook('Beta', teamId, sizes.beta);
    const gammaId = await createTeamNotebook('Gamma', teamId, sizes.gamma);

    const notebooks = await getUserProjectsDetailed(admin, teamId);
    expect(notebooks).toHaveLength(3);

    const byteCountById = new Map(notebooks.map(n => [n._id, n.byteCount]));
    expect(byteCountById.get(alphaId)).toBe(sizes.alpha);
    expect(byteCountById.get(betaId)).toBe(sizes.beta);
    expect(byteCountById.get(gammaId)).toBe(sizes.gamma);
    for (const notebook of notebooks) {
      expect(notebook.byteCount, `byteCount for ${notebook._id}`).toBeTypeOf(
        'number'
      );
    }

    const teamTotal = notebooks.reduce((sum, n) => sum + n.byteCount, 0);
    expect(teamTotal).toBe(sizes.alpha + sizes.beta + sizes.gamma);
  });

  it('fans out one info() call per project for a team with many notebooks', async () => {
    const admin = await getExpressUserFromEmailOrUserId('admin');
    if (!admin) {
      throw new Error('admin user missing');
    }

    const teamId = 'team-many-projects';
    // More than BYTE_COUNT_BATCH_SIZE (10) so the byteCount fan-out spans
    // multiple batches; this is the N+1 info() concern under test.
    const projectCount = 25;
    let expectedTotal = 0;
    for (let i = 0; i < projectCount; i++) {
      const bytes = (i + 1) * 1000;
      expectedTotal += bytes;
      await createTeamNotebook(`Project ${i}`, teamId, bytes);
    }

    infoCallCount = 0;
    const notebooks = await getUserProjectsDetailed(admin, teamId);

    expect(notebooks).toHaveLength(projectCount);
    expect(infoCallCount).toBe(projectCount);
    expect(notebooks.every(n => typeof n.byteCount === 'number')).toBe(true);
    const teamTotal = notebooks.reduce((sum, n) => sum + n.byteCount, 0);
    expect(teamTotal).toBe(expectedTotal);
  });

  it('always populates byteCount as APINotebookListSchema requires, even when the size lookup fails', async () => {
    const admin = await getExpressUserFromEmailOrUserId('admin');
    if (!admin) {
      throw new Error('admin user missing');
    }

    const teamId = 'team-required-contract';
    const healthyId = await createTeamNotebook('Healthy', teamId, 512);
    const brokenId = await createTeamNotebook('Broken', teamId, 999);
    erroringProjects.add(brokenId);

    const notebooks = await getUserProjectsDetailed(admin, teamId);
    expect(notebooks).toHaveLength(2);

    for (const notebook of notebooks) {
      expect(notebook).toHaveProperty('byteCount');
      expect(notebook.byteCount).toBeTypeOf('number');
      expect(() => APINotebookListSchema.parse(notebook)).not.toThrow();
    }

    const byteCountById = new Map(notebooks.map(n => [n._id, n.byteCount]));
    expect(byteCountById.get(healthyId)).toBe(512);
    expect(byteCountById.get(brokenId)).toBe(-1);
  });
});
