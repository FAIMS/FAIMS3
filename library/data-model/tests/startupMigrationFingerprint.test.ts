// SPDX-License-Identifier: Apache-2.0
import {
  STARTUP_MIGRATION_FINGERPRINT_LENGTH,
  buildStartupMigrationFingerprintInput,
  hashStartupMigrationFingerprintInput,
  startupMigrationFingerprint,
} from '../src/data_storage/migrations/startupMigrationFingerprint';

const HEX12 = new RegExp(`^[0-9a-f]{${STARTUP_MIGRATION_FINGERPRINT_LENGTH}}$`);

describe('startupMigrationFingerprint', () => {
  it('returns a stable 12-character lowercase hex digest', async () => {
    const first = await startupMigrationFingerprint();
    const second = await startupMigrationFingerprint();
    expect(first).toMatch(HEX12);
    expect(first).toBe(second);
    expect(
      await hashStartupMigrationFingerprintInput(
        buildStartupMigrationFingerprintInput()
      )
    ).toBe(first);
  });

  it('does not include the directory env default document', () => {
    const directory = buildStartupMigrationFingerprintInput().initPayloads.find(
      payload => payload.name === 'DIRECTORY'
    );
    expect(directory).toBeDefined();
    expect(directory?.content.defaultDocument).toBeUndefined();
  });

  it('changes when a targetVersion is tweaked on a clone', async () => {
    const original = buildStartupMigrationFingerprintInput();
    const tweaked = structuredClone(original);
    const auth = tweaked.targetVersions.find(entry => entry.dbType === 'AUTH');
    expect(auth).toBeDefined();
    auth!.targetVersion += 1;

    expect(await hashStartupMigrationFingerprintInput(tweaked)).not.toBe(
      await hashStartupMigrationFingerprintInput(original)
    );
  });

  it('changes when the notebook uiSpec target is tweaked on a clone', async () => {
    const original = buildStartupMigrationFingerprintInput();
    const tweaked = structuredClone(original);
    tweaked.notebookUiSchemaVersion = `${tweaked.notebookUiSchemaVersion}-tweaked`;

    expect(await hashStartupMigrationFingerprintInput(tweaked)).not.toBe(
      await hashStartupMigrationFingerprintInput(original)
    );
  });

  it('changes when an init payload is tweaked on a clone', async () => {
    const original = buildStartupMigrationFingerprintInput();
    const tweaked = structuredClone(original);
    const auth = tweaked.initPayloads.find(payload => payload.name === 'AUTH');
    expect(auth).toBeDefined();
    auth!.content.designDocuments[0]!._id = '_design/tweaked-fingerprint';

    expect(await hashStartupMigrationFingerprintInput(tweaked)).not.toBe(
      await hashStartupMigrationFingerprintInput(original)
    );
  });

  it('does not change when only apiVersion is present beside the canonical input', async () => {
    const original = buildStartupMigrationFingerprintInput();
    expect(original).not.toHaveProperty('apiVersion');
    const withApiVersion = {
      ...structuredClone(original),
      apiVersion: '9.9.9',
    };

    expect(await hashStartupMigrationFingerprintInput(withApiVersion)).toBe(
      await hashStartupMigrationFingerprintInput(original)
    );
    expect(await hashStartupMigrationFingerprintInput(original)).toBe(
      await startupMigrationFingerprint()
    );
  });
});
