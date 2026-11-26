import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import test from 'node:test';
import {ZodError} from 'zod';
import {
  parseDoConfig,
  DoSecretsSchema,
  parseDigitalOceanConfig,
  doSecretsToTerraformOutput,
} from '../validateConfig.js';
import {generateSigningKeys} from '../scripts/generateSigningKeys.js';

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

const generatedSigningKeys = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: {type: 'pkcs8', format: 'pem'},
  publicKeyEncoding: {type: 'spki', format: 'pem'},
});
const validSigningKeys = {
  privateKey: Buffer.from(generatedSigningKeys.privateKey).toString('base64'),
  publicKey: Buffer.from(generatedSigningKeys.publicKey).toString('base64'),
};

const validSecrets = {
  backup: {
    accessKeyId: 'spaces-access-key',
    secretAccessKey: 'spaces-secret-key',
    resticPassword: 'restic-encryption-password',
  },
  signingKeys: validSigningKeys,
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

test('parseDoConfig accepts an overridden conductor image', () => {
  assert.deepEqual(
    parseDoConfig({
      ...validConfig,
      conductor: {
        ...validConfig.conductor,
        image: {
          registryType: 'DOCKER_HUB',
          registry: 'example',
          repository: 'custom-api',
        },
      },
    }).conductor.image,
    {
      registryType: 'DOCKER_HUB',
      registry: 'example',
      repository: 'custom-api',
    }
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

test('DoSecretsSchema accepts backup credentials and signing keys', () => {
  assert.deepEqual(DoSecretsSchema.parse(validSecrets), validSecrets);
});

test('DoSecretsSchema rejects missing backup credentials', () => {
  assert.throws(
    () =>
      DoSecretsSchema.parse({
        ...validSecrets,
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
  const parsed = parseDigitalOceanConfig(validConfig, validSecrets);
  assert.equal(parsed.do.backup.bucket, 'faims-example-backups');
  assert.equal(
    parsed.secrets.backup.resticPassword,
    'restic-encryption-password'
  );
});

test('DoSecretsSchema rejects signing keys that are not PEM', () => {
  assert.throws(
    () =>
      DoSecretsSchema.parse({
        ...validSecrets,
        signingKeys: {
          ...validSigningKeys,
          publicKey: Buffer.from('not a public key').toString('base64'),
        },
      }),
    ZodError
  );
});

test('DoSecretsSchema rejects a mismatched signing key pair', () => {
  const differentPair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: {type: 'pkcs8', format: 'pem'},
    publicKeyEncoding: {type: 'spki', format: 'pem'},
  });
  assert.throws(
    () =>
      DoSecretsSchema.parse({
        ...validSecrets,
        signingKeys: {
          ...validSigningKeys,
          publicKey: Buffer.from(differentPair.publicKey).toString('base64'),
        },
      }),
    ZodError
  );
});

test('generated signing keys satisfy the DigitalOcean secret contract', () => {
  const generated = generateSigningKeys();
  assert.doesNotThrow(() =>
    DoSecretsSchema.parse({
      backup: validSecrets.backup,
      ...generated,
    })
  );
});

test('Terraform output mapping is owned by the DO secret contract', () => {
  const output = doSecretsToTerraformOutput(validSecrets);
  assert.deepEqual(output, {
    backup_access_key_id: 'spaces-access-key',
    backup_secret_access_key: 'spaces-secret-key',
    restic_password: 'restic-encryption-password',
    signing_private_key: validSigningKeys.privateKey,
    signing_public_key: validSigningKeys.publicKey,
  });
});
