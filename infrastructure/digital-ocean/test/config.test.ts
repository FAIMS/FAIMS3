import assert from 'node:assert/strict';
import test from 'node:test';
import {ZodError} from 'zod';
import {
  parseDoConfig,
  DoSecretsSchema,
  parseDigitalOceanConfig,
  doSecretsToTerraformOutput,
} from '../validateConfig.js';

const validConfig = {
  region: 'syd1',
  conductor: {
    imageTag: 'v1.2.3',
    instanceSize: 'basic-m',
  },
  couch: {
    dropletSize: 's-2vcpu-4gb-intel',
    volumeSize: 400,
    instanceCount: 1,
  },
  storage: {
    bucket: 'faims-map-assets',
    endpoint: 'https://syd1.digitaloceanspaces.com',
  },
  backup: {
    bucket: 'faims-example-backups',
    endpoint: 'https://syd1.digitaloceanspaces.com',
  },
};

test('parseDoConfig accepts the currently used deployment fields', () => {
  assert.deepEqual(parseDoConfig(validConfig), validConfig);
});

test('parseDoConfig rejects unknown fields', () => {
  assert.throws(
    () => parseDoConfig({...validConfig, unsupported: true}),
    ZodError
  );
});

test('parseDoConfig rejects an unpinned conductor image tag', () => {
  assert.throws(
    () =>
      parseDoConfig({
        ...validConfig,
        conductor: {...validConfig.conductor, imageTag: 'latest'},
      }),
    ZodError
  );
});

test('parseDoConfig requires all currently consumed fields', () => {
  const {storage: _storage, ...withoutStorage} = validConfig;
  assert.throws(() => parseDoConfig(withoutStorage), ZodError);
});

test('DoSecretsSchema accepts backup credentials', () => {
  assert.deepEqual(
    DoSecretsSchema.parse({
      backup: {
        accessKeyId: 'spaces-access-key',
        secretAccessKey: 'spaces-secret-key',
        resticPassword: 'restic-encryption-password',
      },
    }),
    {
      backup: {
        accessKeyId: 'spaces-access-key',
        secretAccessKey: 'spaces-secret-key',
        resticPassword: 'restic-encryption-password',
      },
    }
  );
});

test('DoSecretsSchema rejects missing backup credentials', () => {
  assert.throws(
    () =>
      DoSecretsSchema.parse({
        backup: {
          accessKeyId: 'spaces-access-key',
          secretAccessKey: '',
          resticPassword: 'restic-encryption-password',
        },
      }),
    ZodError
  );
});

test('DigitalOcean config validates do.json and do-secrets together', () => {
  const parsed = parseDigitalOceanConfig(validConfig, {
    backup: {
      accessKeyId: 'spaces-access-key',
      secretAccessKey: 'spaces-secret-key',
      resticPassword: 'restic-encryption-password',
    },
  });
  assert.equal(parsed.do.backup.bucket, 'faims-example-backups');
  assert.equal(
    parsed.secrets.backup.resticPassword,
    'restic-encryption-password'
  );
});

test('Terraform output mapping is owned by the DO secret contract', () => {
  const output = doSecretsToTerraformOutput({
    backup: {
      accessKeyId: 'spaces-access-key',
      secretAccessKey: 'spaces-secret-key',
      resticPassword: 'restic-encryption-password',
    },
  });
  assert.deepEqual(output, {
    backup_access_key_id: 'spaces-access-key',
    backup_secret_access_key: 'spaces-secret-key',
    restic_password: 'restic-encryption-password',
  });
});
