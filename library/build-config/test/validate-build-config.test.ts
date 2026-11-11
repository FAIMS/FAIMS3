import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ZodError} from 'zod';
import {
  deepMerge,
  formatValidateError,
  main,
  parseValidateArgs,
  validateBuildConfig,
} from '../src/validate-build-config';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'validate-build-config-'));
}

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

test('parseValidateArgs reads config, config-dir, and secrets flags', () => {
  assert.deepEqual(
    parseValidateArgs([
      '--config-dir',
      'configs/prod',
      '--secrets',
      'secrets.json',
    ]),
    {'config-dir': 'configs/prod', secrets: 'secrets.json'}
  );
  assert.deepEqual(parseValidateArgs(['--config', 'core.json']), {
    config: 'core.json',
  });
  assert.equal(parseValidateArgs(['--help']).help, true);
});

test('validateBuildConfig accepts core.sample.json via --config', () => {
  const result = validateBuildConfig(
    {config: 'config/core.sample.json'},
    {cwd: path.resolve(import.meta.dirname, '..')}
  );
  assert.equal(result.secretsMerged, false);
  assert.match(result.summary, /Configuration is valid/);
  assert.equal(result.core.branding.appName, 'FAIMS');
});

test('validateBuildConfig reads core.json from --config-dir', () => {
  const dir = makeTempDir();
  try {
    writeJson(path.join(dir, 'core.json'), {branding: {appName: 'DirApp'}});
    const result = validateBuildConfig({'config-dir': dir}, {cwd: dir});
    assert.equal(result.core.branding.appName, 'DirApp');
    assert.equal(result.secretsMerged, false);
    assert.equal(result.messages.length, 0);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('validateBuildConfig reads CONFIG_DIR when no path flags are set', () => {
  const dir = makeTempDir();
  try {
    writeJson(path.join(dir, 'core.json'), {branding: {appName: 'EnvDirApp'}});
    const result = validateBuildConfig({}, {cwd: dir, env: {CONFIG_DIR: dir}});
    assert.equal(result.core.branding.appName, 'EnvDirApp');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('validateBuildConfig deep-merges a plaintext secrets overlay', () => {
  const dir = makeTempDir();
  try {
    writeJson(path.join(dir, 'core.json'), {branding: {appName: 'CoreApp'}});
    writeJson(path.join(dir, 'secrets.json'), {
      branding: {appName: 'OverlayApp'},
    });
    const result = validateBuildConfig(
      {'config-dir': dir, secrets: path.join(dir, 'secrets.json')},
      {cwd: dir}
    );
    assert.equal(result.secretsMerged, true);
    assert.equal(result.merged?.branding.appName, 'OverlayApp');
    assert.match(result.summary, /core \+ secrets overlay/);
    assert.match(result.summary, /OverlayApp/);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('validateBuildConfig rejects an overlay that breaks the schema', () => {
  const dir = makeTempDir();
  try {
    writeJson(path.join(dir, 'core.json'), {});
    writeJson(path.join(dir, 'secrets.json'), {
      maps: {notARealMapField: 'nope'},
    });
    assert.throws(
      () =>
        validateBuildConfig(
          {
            config: path.join(dir, 'core.json'),
            secrets: path.join(dir, 'secrets.json'),
          },
          {cwd: dir}
        ),
      ZodError
    );
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('validateBuildConfig skips secrets.enc.json when no SOPS key is set', () => {
  const dir = makeTempDir();
  try {
    writeJson(path.join(dir, 'core.json'), {branding: {appName: 'CoreOnly'}});
    writeJson(path.join(dir, 'secrets.enc.json'), {enc: true});
    const result = validateBuildConfig(
      {'config-dir': dir},
      {cwd: dir, env: {}}
    );
    assert.equal(result.secretsMerged, false);
    assert.match(result.messages[0] ?? '', /Skipping secrets overlay/);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('validateBuildConfig decrypts secrets.enc.json when a SOPS key is set', () => {
  const dir = makeTempDir();
  try {
    writeJson(path.join(dir, 'core.json'), {branding: {appName: 'CoreApp'}});
    writeJson(path.join(dir, 'secrets.enc.json'), {enc: true});
    const result = validateBuildConfig(
      {'config-dir': dir},
      {
        cwd: dir,
        env: {SOPS_AGE_KEY: 'AGE-SECRET-KEY-TEST'},
        decryptEncryptedSecrets: () => ({branding: {appName: 'FromSops'}}),
      }
    );
    assert.equal(result.secretsMerged, true);
    assert.equal(result.merged?.branding.appName, 'FromSops');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('validateBuildConfig rejects missing files and exclusive flags', () => {
  assert.throws(
    () => validateBuildConfig({}),
    /--config <core.json>, --config-dir/
  );
  assert.throws(
    () =>
      validateBuildConfig({
        config: 'core.json',
        'config-dir': 'configs/dev',
      }),
    /only one of --config/
  );
  assert.throws(
    () => validateBuildConfig({config: true as unknown as string}),
    /--config requires a path/
  );
  assert.throws(
    () => validateBuildConfig({config: '/definitely/missing/core.json'}),
    /Config file not found/
  );
});

test('deepMerge matches jq object-merge / rest-wins semantics', () => {
  assert.deepEqual(
    deepMerge({a: {b: 1, c: 2}, keep: true}, {a: {c: 3, d: 4}}),
    {a: {b: 1, c: 3, d: 4}, keep: true}
  );
  assert.deepEqual(deepMerge({list: [1]}, {list: [2, 3]}), {list: [2, 3]});
});

test('formatValidateError pretty-prints Zod issues', () => {
  const dir = makeTempDir();
  try {
    writeJson(path.join(dir, 'core.json'), {notAGroup: true});
    try {
      validateBuildConfig({'config-dir': dir}, {cwd: dir});
      assert.fail('expected ZodError');
    } catch (error) {
      assert.ok(error instanceof ZodError);
      const formatted = formatValidateError(error);
      assert.match(formatted, /Configuration validation failed/);
      assert.match(formatted, /notAGroup/);
    }
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

function withCapturedStdio(run: () => number): {
  code: number;
  stdout: string;
  stderr: string;
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const writeOut = process.stdout.write.bind(process.stdout);
  const writeErr = process.stderr.write.bind(process.stderr);
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
  try {
    return {code: run(), stdout: stdout.join(''), stderr: stderr.join('')};
  } finally {
    process.stdout.write = writeOut;
    process.stderr.write = writeErr;
  }
}

test('main writes help and returns 0', () => {
  const {code, stdout} = withCapturedStdio(() => main(['--help']));
  assert.equal(code, 0);
  assert.match(stdout, /Usage:/);
});

test('main returns 1 for invalid JSON', () => {
  const dir = makeTempDir();
  try {
    fs.writeFileSync(path.join(dir, 'core.json'), '{not-json', 'utf8');
    const {code, stderr} = withCapturedStdio(() =>
      main(['--config-dir', dir], {cwd: dir, env: {}})
    );
    assert.equal(code, 1);
    assert.match(stderr, /Failed to parse JSON/);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});
