import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  applyNotebookSchemaVersionStamp,
  nextMajorSchemaVersion,
} from './couch.ts';

describe('nextMajorSchemaVersion', () => {
  it('bumps the major and resets minor.patch', () => {
    assert.equal(nextMajorSchemaVersion('1.2.3'), '2.0.0');
  });

  it('throws on a non-numeric major', () => {
    assert.throws(() => nextMajorSchemaVersion('v1.0.0'), /Cannot bump/);
  });
});

describe('applyNotebookSchemaVersionStamp', () => {
  it('rewrites uiSpec.schemaVersion and bumps uiSpecProperties.hash', () => {
    const doc = {
      _id: 'notebook_seed_last_good',
      _rev: '1-abc',
      uiSpecification: {
        uiSpec: {schemaVersion: '1.0.0', fields: {title: {}}},
      },
      uiSpecProperties: {
        schemaVersion: '1.0.0',
        hash: 'a'.repeat(64),
      },
    };
    const previousHash = doc.uiSpecProperties.hash;

    const previous = applyNotebookSchemaVersionStamp(doc, '2.0.0');

    assert.equal(previous, '1.0.0');
    assert.equal(doc.uiSpecification.uiSpec.schemaVersion, '2.0.0');
    assert.equal(doc.uiSpecProperties?.schemaVersion, '2.0.0');
    assert.equal(doc.uiSpecProperties?.hash.length, 64);
    assert.notEqual(doc.uiSpecProperties?.hash, previousHash);
  });

  it('throws when uiSpecification.uiSpec is missing', () => {
    assert.throws(
      () =>
        applyNotebookSchemaVersionStamp({_id: 'missing', _rev: '1-x'}, '2.0.0'),
      /no uiSpecification.uiSpec/
    );
  });
});
