// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadEnvDistIfUnset} from '../src/node';

function withTempDir(fn: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-config-node-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
}

function restoreEnv(keys: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(keys)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

test('loadEnvDistIfUnset returns {} when .env.dist is missing', () => {
  withTempDir(dir => {
    assert.deepEqual(loadEnvDistIfUnset(dir), {});
  });
});

test('loadEnvDistIfUnset skips comments and blank lines and strips quotes', () => {
  withTempDir(dir => {
    fs.writeFileSync(
      path.join(dir, '.env.dist'),
      [
        '# comment',
        '',
        'NODE_TEST_FOO=bar',
        'NODE_TEST_QUOTED="hello world"',
        "NODE_TEST_SINGLE='x'",
        'NOEQ',
        '=novalue',
      ].join('\n'),
      'utf8'
    );
    const previous = {
      NODE_TEST_FOO: process.env.NODE_TEST_FOO,
      NODE_TEST_QUOTED: process.env.NODE_TEST_QUOTED,
      NODE_TEST_SINGLE: process.env.NODE_TEST_SINGLE,
    };
    delete process.env.NODE_TEST_FOO;
    delete process.env.NODE_TEST_QUOTED;
    delete process.env.NODE_TEST_SINGLE;
    try {
      const loaded = loadEnvDistIfUnset(dir);
      assert.equal(loaded.NODE_TEST_FOO, 'bar');
      assert.equal(loaded.NODE_TEST_QUOTED, 'hello world');
      assert.equal(loaded.NODE_TEST_SINGLE, 'x');
      assert.equal(loaded.NOEQ, undefined);
      assert.equal(process.env.NODE_TEST_FOO, 'bar');
    } finally {
      restoreEnv(previous);
    }
  });
});

test('loadEnvDistIfUnset does not overwrite existing env', () => {
  withTempDir(dir => {
    fs.writeFileSync(path.join(dir, '.env.dist'), 'NODE_TEST_FOO=from-file\n');
    const previous = process.env.NODE_TEST_FOO;
    process.env.NODE_TEST_FOO = 'existing';
    try {
      const loaded = loadEnvDistIfUnset(dir);
      assert.equal(loaded.NODE_TEST_FOO, 'from-file');
      assert.equal(process.env.NODE_TEST_FOO, 'existing');
    } finally {
      restoreEnv({NODE_TEST_FOO: previous});
    }
  });
});
