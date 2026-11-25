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
    version: '3.5.3',
    dropletImage: 'ubuntu-24-04-x64',
    dropletSize: 's-2vcpu-4gb-intel',
    volumeSize: 400,
    swapSize: 2,
    adminSshCidrs: ['198.51.100.42/32'],
  },
  storage: {
    bucket: 'faims-map-assets',
    endpoint: 'https://syd1.digitaloceanspaces.com',
  },
  backup: {
    bucket: 'faims-example-backups',
    endpoint: 'https://syd1.digitaloceanspaces.com',
    schedule: {
      onCalendar: '*-*-* 03:00:00',
      randomizedDelayMinutes: 15,
    },
    retention: {
      daily: 7,
      weekly: 4,
      monthly: 12,
    },
    tag: 'couchdb-backup',
    logDir: '/var/log/couchdb-backup',
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

test('parseDoConfig rejects non-positive backup retention values', () => {
  assert.throws(
    () =>
      parseDoConfig({
        ...validConfig,
        backup: {
          ...validConfig.backup,
          retention: {
            ...validConfig.backup.retention,
            daily: 0,
          },
        },
      }),
    ZodError
  );
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
