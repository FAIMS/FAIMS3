// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for the project data DB `_design/permissions` validate_doc_update.
 *
 * The validator is a stringified function shipped to CouchDB. These tests
 * take the generated string from `permissionsDocument`, turn it back into a
 * callable, and drive it with synthetic newDoc/oldDoc/userCtx values. They
 * are the mandatory core for the attachment content-type gate because local
 * PouchDB does not execute validate_doc_update at all (no pouchdb-validation
 * plugin is installed), so an in-memory integration test cannot exercise it.
 *
 * Covers:
 * - blocked attachment content types -> {forbidden}
 * - allowed types, two-step store shape, inline-data shape, deletes
 * - structural performance guarantees (non-attachment docs never enter the
 *   gate; gate appears before the role machinery; no heavy ops in source)
 * - pre-existing permission behaviour is unchanged
 */
import {permissionsDocument} from '../src/data_storage/dataDB/design';
import {Action} from '../src/permission/model';
import {necessaryActionToCouchRoleList} from '../src/permission/functions';

const PROJECT_ID = 'test-project';

type Validator = (
  newDoc: Record<string, unknown>,
  oldDoc: Record<string, unknown> | null,
  userCtx: {name?: string | null; roles?: string[]} | null,
  secObj?: unknown
) => void;

/** The generated validator source and a callable built from it. */
function buildValidator(): {source: string; validate: Validator} {
  const source = permissionsDocument(PROJECT_ID).validate_doc_update;
  expect(typeof source).toBe('string');
  // The templated placeholders must have been substituted.
  expect(source).not.toContain('_ACCEPTABLE_');
  // eslint-disable-next-line no-eval
  const validate = eval('(' + source + ')') as Validator;
  return {source, validate};
}

const {source, validate} = buildValidator();

/** A role that satisfies "edit my records" for this project. */
const EDIT_MY_ROLE = necessaryActionToCouchRoleList({
  action: Action.EDIT_MY_PROJECT_RECORDS,
  resourceId: PROJECT_ID,
})[0];
/** A role that satisfies "edit anyone's records" for this project. */
const EDIT_ANY_ROLE = necessaryActionToCouchRoleList({
  action: Action.EDIT_ALL_PROJECT_RECORDS,
  resourceId: PROJECT_ID,
})[0];

const USER = 'alice';
const editorCtx = {name: USER, roles: [EDIT_MY_ROLE]};
const adminCtx = {name: USER, roles: [EDIT_ANY_ROLE]};

function attachmentDoc(
  attachments: Record<string, unknown> | undefined,
  extra: Record<string, unknown> = {}
) {
  const doc: Record<string, unknown> = {
    _id: 'att-1',
    attach_format_version: 1,
    created_by: USER,
    ...extra,
  };
  if (attachments !== undefined) doc._attachments = attachments;
  return doc;
}

function stub(content_type?: string) {
  const s: Record<string, unknown> = {
    stub: true,
    digest: 'md5-abc',
    length: 10,
    revpos: 1,
  };
  if (content_type !== undefined) s.content_type = content_type;
  return s;
}

/** Calls the validator and returns the thrown object (or null if it passed). */
function outcome(
  newDoc: Record<string, unknown>,
  oldDoc: Record<string, unknown> | null = null,
  userCtx: {name?: string | null; roles?: string[]} | null = editorCtx
): Record<string, unknown> | null {
  try {
    validate(newDoc, oldDoc, userCtx);
    return null;
  } catch (e) {
    return e as Record<string, unknown>;
  }
}

function expectForbiddenContent(
  result: Record<string, unknown> | null,
  type?: string
) {
  expect(result).not.toBeNull();
  expect(result).toHaveProperty('forbidden');
  expect(result).not.toHaveProperty('unauthorized');
  expect(result!.forbidden).toMatch(/Attachments of type .* are not allowed/);
  if (type !== undefined) {
    expect(result!.forbidden).toContain(`type ${type} `);
  }
}

function expectNotContentRejected(result: Record<string, unknown> | null) {
  // May pass entirely or hit the pre-existing auth logic; must not be the
  // content gate.
  if (result !== null) {
    expect(result).not.toHaveProperty('forbidden');
  }
}

// ---------------------------------------------------------------------------
// 1. Blocked
// ---------------------------------------------------------------------------

describe('validate_doc_update attachment content-type gate: blocked', () => {
  it.each([
    ['image/svg+xml', 'image/svg+xml'],
    ['image/svg', 'image/svg'],
    ['text/html', 'text/html'],
    ['application/xhtml+xml', 'application/xhtml+xml'],
    ['application/x-html', 'application/x-html'],
    ['text/xhtml', 'text/xhtml'],
    ['IMAGE/SVG+XML', 'image/svg+xml'],
    ['image/svg+xml; charset=utf-8', 'image/svg+xml'],
    ['  text/html ', 'text/html'],
  ])('rejects stub content_type %j with {forbidden}', (declared, norm) => {
    const result = outcome(attachmentDoc({att1: stub(declared)}));
    expectForbiddenContent(result, norm);
  });

  it('rejects a stub with a missing content_type (fail closed)', () => {
    const result = outcome(attachmentDoc({att1: stub(undefined)}));
    expectForbiddenContent(result, '(missing)');
  });

  it('rejects a stub with an empty content_type', () => {
    const result = outcome(attachmentDoc({att1: stub('')}));
    expectForbiddenContent(result, '(missing)');
  });

  it('rejects when only the second of two stubs is blocked', () => {
    const result = outcome(
      attachmentDoc({
        first: stub('image/jpeg'),
        second: stub('image/svg+xml'),
      })
    );
    expectForbiddenContent(result, 'image/svg+xml');
  });

  it('rejects regardless of the caller having edit-any rights', () => {
    const result = outcome(
      attachmentDoc({att1: stub('image/svg+xml')}),
      null,
      adminCtx
    );
    expectForbiddenContent(result, 'image/svg+xml');
  });

  it('rejects an old client re-putting an existing SVG attachment doc', () => {
    // Same _id, new _rev: a non-delete update of a legacy hostile doc. This
    // surfaces as a per-document 403 during replication, not a sync halt.
    const existing = attachmentDoc(
      {att1: stub('image/svg+xml')},
      {_rev: '1-a'}
    );
    const update = attachmentDoc({att1: stub('image/svg+xml')}, {_rev: '2-b'});
    expectForbiddenContent(outcome(update, existing), 'image/svg+xml');
  });
});

// ---------------------------------------------------------------------------
// 2-5. Allowed types and shapes
// ---------------------------------------------------------------------------

describe('validate_doc_update attachment content-type gate: allowed', () => {
  it.each([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/octet-stream',
    'audio/webm',
    'audio/mp4',
    'text/csv',
    'text/plain',
    'application/zip',
    'application/gpx+xml',
    'image/jpeg; charset=binary',
  ])('does not content-reject stub content_type %j', type => {
    const result = outcome(attachmentDoc({att1: stub(type)}));
    expectNotContentRejected(result);
    // With an edit-my role and matching author, the write passes entirely.
    expect(result).toBeNull();
  });

  it('two-step shape: attachment doc with no _attachments key passes the gate', () => {
    // storeAttachmentFromBlob first `put`s the doc without `_attachments`,
    // then calls putAttachment (which presents the stub and is checked).
    const result = outcome(attachmentDoc(undefined));
    expect(result).toBeNull();
  });

  it('two-step shape: empty _attachments object passes the gate', () => {
    expect(outcome(attachmentDoc({}))).toBeNull();
  });

  it('inline-data shape: benign type with data is not content-rejected', () => {
    const result = outcome(
      attachmentDoc({
        att1: {content_type: 'image/jpeg', data: 'AAAA'},
      })
    );
    expect(result).toBeNull();
  });

  it('inline-data shape: SVG type with data is rejected (reads content_type, not stub-ness)', () => {
    const result = outcome(
      attachmentDoc({
        att1: {content_type: 'image/svg+xml', data: 'PHN2Zz4='},
      })
    );
    expectForbiddenContent(result, 'image/svg+xml');
  });

  it('deletion carve-out: _deleted attachment doc with an SVG stub is not content-rejected', () => {
    const existing = attachmentDoc(
      {att1: stub('image/svg+xml')},
      {_rev: '1-a'}
    );
    const deletion = attachmentDoc(
      {att1: stub('image/svg+xml')},
      {_rev: '2-b', _deleted: true}
    );
    const result = outcome(deletion, existing, {
      name: USER,
      roles: necessaryActionToCouchRoleList({
        action: Action.DELETE_MY_PROJECT_RECORDS,
        resourceId: PROJECT_ID,
      }),
    });
    expectNotContentRejected(result);
    expect(result).toBeNull();
  });

  it('deletion carve-out: tombstone-only _deleted doc is not content-rejected', () => {
    const existing = attachmentDoc(
      {att1: stub('image/svg+xml')},
      {_rev: '1-a'}
    );
    const tombstone = {
      _id: 'att-1',
      _rev: '2-b',
      _deleted: true,
      attach_format_version: 1,
      created_by: USER,
    };
    expectNotContentRejected(outcome(tombstone, existing));
  });
});

// ---------------------------------------------------------------------------
// 6. Gate / performance structure
// ---------------------------------------------------------------------------

describe('validate_doc_update attachment content-type gate: structure', () => {
  function manySvgStubs(n: number) {
    const atts: Record<string, unknown> = {};
    for (let i = 0; i < n; i++) atts[`a${i}`] = stub('image/svg+xml');
    return atts;
  }

  it('skips the gate for record docs even with 1,000 SVG-typed stubs', () => {
    const record = {
      _id: 'rec-1',
      record_format_version: 1,
      created_by: USER,
      _attachments: manySvgStubs(1000),
    };
    const result = outcome(record);
    expectNotContentRejected(result);
    expect(result).toBeNull();
  });

  it('skips the gate for revision docs', () => {
    const revision = {
      _id: 'frev-1',
      revision_format_version: 1,
      created_by: USER,
      _attachments: manySvgStubs(5),
    };
    expectNotContentRejected(outcome(revision));
  });

  it('skips the gate for AVP docs', () => {
    const avp = {
      _id: 'avp-1',
      avp_format_version: 1,
      created_by: USER,
      _attachments: manySvgStubs(5),
    };
    expectNotContentRejected(outcome(avp));
  });

  it('skips the gate for other attach_format_version values', () => {
    const odd = attachmentDoc(
      {att1: stub('image/svg+xml')},
      {
        attach_format_version: 2,
      }
    );
    expectNotContentRejected(outcome(odd));
  });

  it('never reads _attachments on a non-attachment document', () => {
    let touched = false;
    const record: Record<string, unknown> = {
      _id: 'rec-1',
      record_format_version: 1,
      created_by: USER,
    };
    Object.defineProperty(record, '_attachments', {
      enumerable: true,
      get() {
        touched = true;
        return manySvgStubs(3);
      },
    });
    outcome(record);
    expect(touched).toBe(false);
  });

  it('reads only content_type on an attachment stub (never data/digest/length)', () => {
    const read: string[] = [];
    const spyStub = new Proxy(stub('image/jpeg'), {
      get(target, prop) {
        read.push(String(prop));
        return Reflect.get(target, prop);
      },
    });
    expect(outcome(attachmentDoc({att1: spyStub}))).toBeNull();
    expect(read).toContain('content_type');
    expect(read).not.toContain('data');
    expect(read).not.toContain('digest');
    expect(read).not.toContain('length');
  });

  it('fails fast: stops at the first blocked stub', () => {
    const reads: string[] = [];
    const tracked = (name: string, type: string) =>
      new Proxy(stub(type), {
        get(target, prop) {
          if (prop === 'content_type') reads.push(name);
          return Reflect.get(target, prop);
        },
      });
    outcome(
      attachmentDoc({
        a: tracked('a', 'image/jpeg'),
        b: tracked('b', 'image/svg+xml'),
        c: tracked('c', 'image/jpeg'),
      })
    );
    expect(reads).toEqual(['a', 'b']);
  });

  it('places the gate after the login checks and before the role lists', () => {
    const gateAt = source.indexOf('attach_format_version === 1');
    const usernameCheckAt = source.indexOf('No username given');
    const roleListsAt = source.indexOf('acceptableEditAnyRoles');
    expect(gateAt).toBeGreaterThan(-1);
    expect(usernameCheckAt).toBeGreaterThan(-1);
    expect(roleListsAt).toBeGreaterThan(-1);
    expect(gateAt).toBeGreaterThan(usernameCheckAt);
    expect(gateAt).toBeLessThan(roleListsAt);
  });

  it('gate tests identity and _deleted before touching _attachments', () => {
    const gateAt = source.indexOf('attach_format_version === 1');
    const attachmentsAt = source.indexOf('_attachments');
    expect(attachmentsAt).toBeGreaterThan(gateAt);
    const gateLine = source.slice(gateAt, source.indexOf('{', gateAt));
    expect(gateLine).toContain('_deleted');
  });

  it('contains no heavyweight operations', () => {
    expect(source).not.toContain('JSON.stringify');
    expect(source).not.toContain('JSON.parse');
    expect(source).not.toMatch(/\.data\b/);
    expect(source).not.toContain('.digest');
    expect(source).not.toContain('Object.keys');
    expect(source).not.toContain('Object.entries');
    expect(source).not.toContain('Object.values');
    // No regular-expression literals anywhere in the validator.
    expect(source).not.toMatch(/[=(,:]\s*\/[^/*\n][^\n]*\/[gimsuy]*\s*[;,)]/);
    expect(source).not.toContain('new RegExp');
    expect(source).not.toContain('.match(');
    expect(source).not.toContain('.replace(');
    expect(source).not.toContain('.test(');
  });

  it('throws forbidden (not unauthorized) for content rejections', () => {
    const idx = source.indexOf('Attachments of type');
    expect(idx).toBeGreaterThan(-1);
    const window = source.slice(Math.max(0, idx - 200), idx);
    expect(window).toContain('forbidden');
    expect(window).not.toContain('unauthorized');
  });

  it('blocklist in the validator matches the forms-side list', () => {
    // Manual-sync guard for BLOCKED_ATTACHMENT_CONTENT_TYPES in
    // library/forms/lib/utils.ts.
    for (const t of [
      'image/svg+xml',
      'image/svg',
      'text/html',
      'application/xhtml+xml',
      'application/x-html',
      'text/xhtml',
    ]) {
      expect(source).toContain(`'${t}'`);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Pre-existing permission behaviour unchanged
// ---------------------------------------------------------------------------

describe('validate_doc_update pre-existing permission logic', () => {
  const record = (extra: Record<string, unknown> = {}) => ({
    _id: 'rec-1',
    record_format_version: 1,
    created_by: USER,
    ...extra,
  });

  it('requires a user context', () => {
    expect(outcome(record(), null, null)).toHaveProperty('unauthorized');
    expect(outcome(record(), null, {name: null})).toHaveProperty(
      'unauthorized'
    );
  });

  it('blocks author changes', () => {
    const result = outcome(record({created_by: 'bob'}), record(), adminCtx);
    expect(result).toHaveProperty('unauthorized');
    expect(result!.unauthorized).toMatch(/change the author/);
  });

  it('lets an editor edit their own record and not another user', () => {
    expect(outcome(record())).toBeNull();
    const other = outcome(record({created_by: 'bob'}), null, editorCtx);
    expect(other).toHaveProperty('unauthorized');
  });

  it('lets an edit-any role edit another user record', () => {
    expect(outcome(record({created_by: 'bob'}), null, adminCtx)).toBeNull();
  });

  it('still allows a benign attachment doc subject to the same role checks', () => {
    const doc = attachmentDoc({att1: stub('image/jpeg')}, {created_by: 'bob'});
    expect(outcome(doc, null, editorCtx)).toHaveProperty('unauthorized');
    expect(outcome(doc, null, adminCtx)).toBeNull();
  });
});
