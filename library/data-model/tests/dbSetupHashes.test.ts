// SPDX-License-Identifier: Apache-2.0
/**
 * Pin each database type's design/security version and content hash.
 *
 * Changing a design or security document without updating this file fails
 * the test: bump `DB_SETUP_VERSIONS` for a real change, or keep the version
 * and update the hash here for a same-version patch.
 */
import {
  contentForSetupType,
  DB_SETUP_TYPES,
  DB_SETUP_VERSIONS,
  hashDesignDocuments,
  hashSecurityDocument,
  type DbSetupType,
} from '../src/data_storage';

type PinnedSetup = {
  design: number;
  security: number;
  designHash: string;
  securityHash: string;
};

export const PINNED_DB_SETUP_HASHES: Record<DbSetupType, PinnedSetup> = {
  AUTH: {
    design: 1,
    security: 1,
    designHash:
      '128492dbebc94c978959b1eeea07e4dfa455f4ecc6cbe9d3b536eb690a2b4614',
    securityHash:
      '6895f26a93ef35431a615fea6170e470f14a4e1ac2bfe3db768afcf5c32fb3ef',
  },
  DATA: {
    design: 1,
    security: 1,
    designHash:
      'f2c36ba2c5cacbb333f54cfd1b032389530a5b8d2cd5ca339f724f54c592f24a',
    securityHash:
      'd4a5100ecaef3df6de1443124bb5ed20f1ec1529dde8cee9bdc1b1a0a3879643',
  },
  DIRECTORY: {
    design: 1,
    security: 1,
    designHash:
      '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
    securityHash:
      '6895f26a93ef35431a615fea6170e470f14a4e1ac2bfe3db768afcf5c32fb3ef',
  },
  INVITES: {
    design: 1,
    security: 1,
    designHash:
      '73636a425a94558c27fadb58da6c548b3420a823913fbb56632b7bb5710ff449',
    securityHash:
      '6895f26a93ef35431a615fea6170e470f14a4e1ac2bfe3db768afcf5c32fb3ef',
  },
  PEOPLE: {
    design: 1,
    security: 1,
    designHash:
      'e059df76ca8d85ffa7da4216b8e6f209e569834edb02e4aefca9b99f9a566ec1',
    securityHash:
      '6895f26a93ef35431a615fea6170e470f14a4e1ac2bfe3db768afcf5c32fb3ef',
  },
  PROJECTS: {
    design: 1,
    security: 1,
    designHash:
      '1f6d6c264e7478f2171bde8239c4642b050bed52e4914c564ea5f8355a28f917',
    securityHash:
      '6895f26a93ef35431a615fea6170e470f14a4e1ac2bfe3db768afcf5c32fb3ef',
  },
  TEMPLATES: {
    design: 1,
    security: 1,
    designHash:
      '72f2cce80972c86bf69984ab8892b0cfca5b31e222d8e5217ab116b8c256e85f',
    securityHash:
      '6895f26a93ef35431a615fea6170e470f14a4e1ac2bfe3db768afcf5c32fb3ef',
  },
  TEAMS: {
    design: 1,
    security: 1,
    designHash:
      '16ffb39aaa419dfc04c7ade5d6e3a79318cdef649802cb298819a80a05928795',
    securityHash:
      '6895f26a93ef35431a615fea6170e470f14a4e1ac2bfe3db768afcf5c32fb3ef',
  },
  MAP_ASSETS: {
    design: 1,
    security: 1,
    designHash:
      'f08d879d202cb3ab54a623c767c28e88c36080dfc758b562fecf1774ebb4baf1',
    securityHash:
      '6895f26a93ef35431a615fea6170e470f14a4e1ac2bfe3db768afcf5c32fb3ef',
  },
  TOMBSTONE: {
    design: 1,
    security: 1,
    designHash:
      '62fb3680571798de6334ab057e70ec62ed1526933e80b6367105b1e1bb9c6cc3',
    securityHash:
      '6895f26a93ef35431a615fea6170e470f14a4e1ac2bfe3db768afcf5c32fb3ef',
  },
  MIGRATIONS: {
    design: 1,
    security: 1,
    designHash:
      'b5f9dc23268d8886530b0bbe8d0937dbba73eb2c709d77cad95401d1b8102822',
    securityHash:
      '6895f26a93ef35431a615fea6170e470f14a4e1ac2bfe3db768afcf5c32fb3ef',
  },
};

describe('pinned db-setup hashes', () => {
  it('matches DB_SETUP_VERSIONS and the current init payloads', async () => {
    const actual = {} as Record<DbSetupType, PinnedSetup>;
    for (const type of DB_SETUP_TYPES) {
      const payload = contentForSetupType(type);
      actual[type] = {
        design: DB_SETUP_VERSIONS[type].design,
        security: DB_SETUP_VERSIONS[type].security,
        designHash: await hashDesignDocuments(payload.designDocuments),
        securityHash: await hashSecurityDocument(payload.securityDocument),
      };
    }
    expect(actual).toEqual(PINNED_DB_SETUP_HASHES);
  });
});
