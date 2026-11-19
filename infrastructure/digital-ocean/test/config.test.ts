import assert from 'node:assert/strict';
import test from 'node:test';
import {ZodError} from 'zod';
import {parseDoConfig} from '../validateConfig.js';

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
