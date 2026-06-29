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
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: notebookStorageStats.test.ts
 * Description:
 *   Tests for getUserProjectsDetailed's per-project byteCount, the team storage
 *   total it feeds, the N+1 info() fan-out over a team's notebooks, and the
 *   byteCount required-vs-optional schema contract.
 */
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing
PouchDB.plugin(PouchDBFind);

import {APINotebookListSchema} from '@faims3/data-model';
import {expect} from 'chai';
import sinon from 'sinon';
// Imported as a namespace so getNanoDataDb (the cross-module call getByteCount
// makes) can be stubbed without hitting a real CouchDB during tests.
import * as couchdb from '../src/couchdb';
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
    sinon.stub(couchdb, 'getNanoDataDb').callsFake((async (projectId: string) => {
      return {
        info: async () => {
          infoCallCount++;
          if (erroringProjects.has(projectId)) {
            throw new Error(`simulated CouchDB info() failure for ${projectId}`);
          }
          return {sizes: {active: byteCountByProject.get(projectId) ?? 0}};
        },
      };
    }) as any);
  });

  afterEach(() => {
    sinon.restore();
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
    expect(notebooks).to.have.lengthOf(3);

    // Each project carries its own byteCount, matched to the right project.
    const byteCountById = new Map(notebooks.map(n => [n._id, n.byteCount]));
    expect(byteCountById.get(alphaId)).to.equal(sizes.alpha);
    expect(byteCountById.get(betaId)).to.equal(sizes.beta);
    expect(byteCountById.get(gammaId)).to.equal(sizes.gamma);
    for (const notebook of notebooks) {
      expect(notebook.byteCount, `byteCount for ${notebook._id}`).to.be.a(
        'number'
      );
    }

    // The team total (what the UI sums for the team) equals the per-project sum.
    const teamTotal = notebooks.reduce((sum, n) => sum + n.byteCount, 0);
    expect(teamTotal).to.equal(sizes.alpha + sizes.beta + sizes.gamma);
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

    // Count only the info() calls made by the listing itself, not creation.
    infoCallCount = 0;
    const notebooks = await getUserProjectsDetailed(admin, teamId);

    expect(notebooks).to.have.lengthOf(projectCount);
    // One CouchDB info() round-trip per project: the N+1 fan-out.
    expect(infoCallCount).to.equal(projectCount);
    // Every project's byteCount is populated; no batch is dropped.
    expect(notebooks.every(n => typeof n.byteCount === 'number')).to.be.true;
    const teamTotal = notebooks.reduce((sum, n) => sum + n.byteCount, 0);
    expect(teamTotal).to.equal(expectedTotal);
  });

  it('always populates byteCount as APINotebookListSchema requires, even when the size lookup fails', async () => {
    const admin = await getExpressUserFromEmailOrUserId('admin');
    if (!admin) {
      throw new Error('admin user missing');
    }

    const teamId = 'team-required-contract';
    const healthyId = await createTeamNotebook('Healthy', teamId, 512);
    const brokenId = await createTeamNotebook('Broken', teamId, 999);
    // Simulate getByteCount catching a CouchDB info() failure for this project.
    erroringProjects.add(brokenId);

    const notebooks = await getUserProjectsDetailed(admin, teamId);
    expect(notebooks).to.have.lengthOf(2);

    for (const notebook of notebooks) {
      // byteCount is declared z.number() (required, not optional) on
      // APINotebookListSchema, so it must be present on every row...
      expect(notebook).to.have.property('byteCount');
      expect(notebook.byteCount).to.be.a('number');
      // ...and the full row validates against the wire schema.
      expect(() => APINotebookListSchema.parse(notebook)).to.not.throw();
    }

    const byteCountById = new Map(notebooks.map(n => [n._id, n.byteCount]));
    expect(byteCountById.get(healthyId)).to.equal(512);
    // A failed lookup maps to -1 (still a number), never an absent field.
    expect(byteCountById.get(brokenId)).to.equal(-1);
  });
});
