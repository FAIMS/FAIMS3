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
 *   gate; gate appears before the role machinery)
 * - the permission logic itself: login, author lock, edit-my / edit-any /
 *   delete-my / delete-any role lists, project scoping, ownership resolution
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
// 7. Permission logic
// ---------------------------------------------------------------------------

describe('validate_doc_update permission logic', () => {
  const OTHER_USER = 'bob';
  const OTHER_PROJECT = 'some-other-project';

  const roleList = (action: Action, resourceId = PROJECT_ID) =>
    necessaryActionToCouchRoleList({action, resourceId});

  const editMyRoles = roleList(Action.EDIT_MY_PROJECT_RECORDS);
  const editAnyRoles = roleList(Action.EDIT_ALL_PROJECT_RECORDS);
  const deleteMyRoles = roleList(Action.DELETE_MY_PROJECT_RECORDS);
  const deleteAnyRoles = roleList(Action.DELETE_ALL_PROJECT_RECORDS);

  // Roles that grant "my" but not "any" (e.g. project guest).
  const myOnlyEditRoles = editMyRoles.filter(r => !editAnyRoles.includes(r));
  const myOnlyDeleteRoles = deleteMyRoles.filter(
    r => !deleteAnyRoles.includes(r)
  );

  const ctx = (roles: string[], name: string = USER) => ({name, roles});

  const record = (extra: Record<string, unknown> = {}) => ({
    _id: 'rec-1',
    record_format_version: 1,
    created_by: USER,
    ...extra,
  });
  const mine = record({_rev: '1-a'});
  const theirs = record({_rev: '1-a', created_by: OTHER_USER});

  const expectUnauthorized = (
    result: Record<string, unknown> | null,
    message: RegExp
  ) => {
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('unauthorized');
    expect(result).not.toHaveProperty('forbidden');
    expect(result!.unauthorized).toMatch(message);
  };

  describe('templating', () => {
    it('substitutes every role placeholder with the per-project role lists', () => {
      expect(source).not.toContain('_ACCEPTABLE_');
      for (const r of [
        ...editMyRoles,
        ...editAnyRoles,
        ...deleteMyRoles,
        ...deleteAnyRoles,
      ]) {
        expect(source).toContain(`'${r}'`);
      }
    });

    it('is scoped to the project it was built for', () => {
      const other = permissionsDocument(OTHER_PROJECT).validate_doc_update;
      expect(other).toContain(`'${OTHER_PROJECT}||`);
      expect(other).not.toContain(`'${PROJECT_ID}||`);
    });

    it('the role model distinguishes my-only roles from any roles', () => {
      // Sanity check on the role model these tests rely on: at least one
      // role (project guest) can edit/delete its own records but not others'.
      expect(myOnlyEditRoles.length).toBeGreaterThan(0);
      expect(myOnlyDeleteRoles.length).toBeGreaterThan(0);
      // Every "any" role also satisfies "my".
      for (const r of editAnyRoles) expect(editMyRoles).toContain(r);
      for (const r of deleteAnyRoles) expect(deleteMyRoles).toContain(r);
    });
  });

  describe('login requirement', () => {
    it.each([
      ['null userCtx', null],
      ['null name', {name: null, roles: editAnyRoles}],
      ['undefined name', {roles: editAnyRoles}],
    ])('rejects %s even with full roles', (_label, userCtx) => {
      const result = outcome(record(), null, userCtx);
      expectUnauthorized(result, /must be logged in/);
    });

    it('rejects an undefined userCtx', () => {
      // Call directly: `outcome` would substitute its default context.
      let thrown: Record<string, unknown> | null = null;
      try {
        validate(record(), null, undefined as unknown as null);
      } catch (e) {
        thrown = e as Record<string, unknown>;
      }
      expectUnauthorized(thrown, /must be logged in/);
    });

    it('login check runs before the attachment gate', () => {
      const result = outcome(
        attachmentDoc({att1: stub('image/svg+xml')}),
        null,
        null
      );
      expectUnauthorized(result, /must be logged in/);
    });
  });

  describe('author lock', () => {
    it('rejects changing created_by on an existing doc, even for edit-any', () => {
      const result = outcome(
        record({created_by: OTHER_USER}),
        mine,
        ctx(editAnyRoles)
      );
      expectUnauthorized(result, /change the author/);
    });

    it('rejects changing created_by on an existing doc owned by someone else', () => {
      // bob's record, alice tries to claim it
      const result = outcome(
        record({created_by: USER}),
        theirs,
        ctx(editAnyRoles)
      );
      expectUnauthorized(result, /change the author/);
    });

    it('allows an update that keeps created_by unchanged', () => {
      expect(outcome(record({extra: 1}), mine, ctx(editMyRoles))).toBeNull();
    });

    it('does not apply when the old doc has no created_by', () => {
      const legacy = {_id: 'rec-1', _rev: '1-a', record_format_version: 1};
      expect(outcome(record(), legacy, ctx(editAnyRoles))).toBeNull();
    });

    it('does not apply when the new doc has no created_by', () => {
      const stripped = {_id: 'rec-1', record_format_version: 1};
      // Ownership falls back to the old doc, which is mine.
      expect(outcome(stripped, mine, ctx(editMyRoles))).toBeNull();
    });

    it('does not apply on creation (no old doc)', () => {
      expect(outcome(record(), null, ctx(editMyRoles))).toBeNull();
    });
  });

  describe('editing my own record', () => {
    it.each(editMyRoles)('allows role %s to create a record it owns', role => {
      expect(outcome(record(), null, ctx([role]))).toBeNull();
    });

    it.each(editMyRoles)('allows role %s to update a record it owns', role => {
      expect(outcome(record({x: 1}), mine, ctx([role]))).toBeNull();
    });

    it('rejects with no roles', () => {
      expectUnauthorized(outcome(record(), null, ctx([])), /edit your record/);
    });

    it('rejects when roles is undefined', () => {
      expectUnauthorized(
        outcome(record(), null, {name: USER}),
        /edit your record/
      );
    });

    it('rejects a role for a different project', () => {
      const foreign = roleList(Action.EDIT_ALL_PROJECT_RECORDS, OTHER_PROJECT)
        // Keep only the project-scoped roles; global roles would still apply.
        .filter(r => r.includes('||'));
      expect(foreign.length).toBeGreaterThan(0);
      expectUnauthorized(
        outcome(record(), null, ctx(foreign)),
        /edit your record/
      );
    });

    it('rejects an unrelated / malformed role string', () => {
      expectUnauthorized(
        outcome(record(), null, ctx(['PROJECT_ADMIN', `${PROJECT_ID}||`])),
        /edit your record/
      );
    });

    it('only needs one acceptable role among many', () => {
      const roles = ['junk', 'more-junk', editMyRoles[0]];
      expect(outcome(record(), null, ctx(roles))).toBeNull();
    });
  });

  describe("editing another user's record", () => {
    it.each(editAnyRoles)(
      'allows role %s to create a record owned by someone else',
      role => {
        expect(
          outcome(record({created_by: OTHER_USER}), null, ctx([role]))
        ).toBeNull();
      }
    );

    it.each(editAnyRoles)(
      "allows role %s to update someone else's record",
      role => {
        expect(
          outcome(record({created_by: OTHER_USER, x: 1}), theirs, ctx([role]))
        ).toBeNull();
      }
    );

    it.each(myOnlyEditRoles)(
      'rejects my-only role %s from creating a record owned by someone else',
      role => {
        expectUnauthorized(
          outcome(record({created_by: OTHER_USER}), null, ctx([role])),
          /edit another user's record/
        );
      }
    );

    it.each(myOnlyEditRoles)(
      "rejects my-only role %s from updating someone else's record",
      role => {
        expectUnauthorized(
          outcome(record({created_by: OTHER_USER, x: 1}), theirs, ctx([role])),
          /edit another user's record/
        );
      }
    );

    it('rejects with no roles', () => {
      expectUnauthorized(
        outcome(record({created_by: OTHER_USER}), null, ctx([])),
        /edit another user's record/
      );
    });
  });

  describe('ownership resolution', () => {
    it('uses the old doc to decide ownership when one exists', () => {
      // Old doc is bob's; new doc omits created_by so the author lock does
      // not fire. A my-only role must still be refused because it is bob's.
      const stripped = {_id: 'rec-1', record_format_version: 1};
      expectUnauthorized(
        outcome(stripped, theirs, ctx(myOnlyEditRoles)),
        /edit another user's record/
      );
    });

    it('a new doc with no created_by is not mine', () => {
      const anonymous = {_id: 'rec-1', record_format_version: 1};
      expectUnauthorized(
        outcome(anonymous, null, ctx(myOnlyEditRoles)),
        /edit another user's record/
      );
      expect(outcome(anonymous, null, ctx(editAnyRoles))).toBeNull();
    });

    it('an old doc with no created_by is not mine', () => {
      const legacy = {_id: 'rec-1', _rev: '1-a', record_format_version: 1};
      expectUnauthorized(
        outcome(record(), legacy, ctx(myOnlyEditRoles)),
        /edit another user's record/
      );
    });

    it('ownership is an exact match on the user name', () => {
      expectUnauthorized(
        outcome(record(), null, ctx(myOnlyEditRoles, USER.toUpperCase())),
        /edit another user's record/
      );
    });
  });

  describe('deleting', () => {
    const deletedMine = record({_rev: '2-b', _deleted: true});
    const deletedTheirs = record({
      _rev: '2-b',
      _deleted: true,
      created_by: OTHER_USER,
    });

    it.each(deleteMyRoles)('allows role %s to delete its own record', role => {
      expect(outcome(deletedMine, mine, ctx([role]))).toBeNull();
    });

    it.each(deleteAnyRoles)(
      "allows role %s to delete someone else's record",
      role => {
        expect(outcome(deletedTheirs, theirs, ctx([role]))).toBeNull();
      }
    );

    it.each(myOnlyDeleteRoles)(
      "rejects my-only role %s from deleting someone else's record",
      role => {
        expectUnauthorized(
          outcome(deletedTheirs, theirs, ctx([role])),
          /delete another user's record/
        );
      }
    );

    it('rejects deleting my own record with no delete role', () => {
      expectUnauthorized(
        outcome(deletedMine, mine, ctx([])),
        /delete your record/
      );
    });

    it('treats the soft `deleted` flag the same as `_deleted`', () => {
      const softDeleted = record({_rev: '2-b', deleted: true});
      expect(outcome(softDeleted, mine, ctx(deleteMyRoles))).toBeNull();
      expectUnauthorized(
        outcome(softDeleted, mine, ctx([])),
        /delete your record/
      );
    });

    it('is only a delete when the old doc was not already deleted', () => {
      // Re-saving an already deleted doc is treated as an edit.
      const alreadyDeleted = record({_rev: '2-b', _deleted: true});
      const again = record({_rev: '3-c', _deleted: true});
      expectUnauthorized(
        outcome(again, alreadyDeleted, ctx([])),
        /edit your record/
      );
      expect(outcome(again, alreadyDeleted, ctx(editMyRoles))).toBeNull();
    });

    it('a brand-new tombstone (no old doc) is treated as an edit', () => {
      const tombstone = record({_deleted: true});
      expect(outcome(tombstone, null, ctx(editMyRoles))).toBeNull();
      expectUnauthorized(outcome(tombstone, null, ctx([])), /edit your record/);
    });

    it('uses the old doc owner when deciding whose record is being deleted', () => {
      // Tombstone omits created_by; old doc is bob's.
      const tombstone = {_id: 'rec-1', _rev: '2-b', _deleted: true};
      expectUnauthorized(
        outcome(tombstone, theirs, ctx(myOnlyDeleteRoles)),
        /delete another user's record/
      );
      expect(outcome(tombstone, theirs, ctx(deleteAnyRoles))).toBeNull();
    });

    it('the author lock still applies to a delete that rewrites created_by', () => {
      const result = outcome(
        record({_rev: '2-b', _deleted: true, created_by: OTHER_USER}),
        mine,
        ctx(deleteAnyRoles)
      );
      expectUnauthorized(result, /change the author/);
    });
  });

  describe('applies uniformly to every document kind', () => {
    const kinds: [string, Record<string, unknown>][] = [
      ['record', {_id: 'rec-1', record_format_version: 1}],
      ['revision', {_id: 'frev-1', revision_format_version: 1}],
      ['avp', {_id: 'avp-1', avp_format_version: 1}],
      ['attachment', {_id: 'att-1', attach_format_version: 1}],
      ['untyped', {_id: 'misc-1'}],
    ];

    it.each(kinds)(
      '%s: my-only role can write its own, not others',
      (_k, base) => {
        expect(
          outcome({...base, created_by: USER}, null, ctx(myOnlyEditRoles))
        ).toBeNull();
        expectUnauthorized(
          outcome(
            {...base, created_by: OTHER_USER},
            null,
            ctx(myOnlyEditRoles)
          ),
          /edit another user's record/
        );
      }
    );

    it.each(kinds)('%s: edit-any role can write others', (_k, base) => {
      expect(
        outcome({...base, created_by: OTHER_USER}, null, ctx(editAnyRoles))
      ).toBeNull();
    });
  });

  describe('attachment gate and permissions compose', () => {
    it('a benign attachment doc is still subject to the role checks', () => {
      const doc = attachmentDoc(
        {att1: stub('image/jpeg')},
        {created_by: OTHER_USER}
      );
      expectUnauthorized(
        outcome(doc, null, ctx(myOnlyEditRoles)),
        /edit another user's record/
      );
      expect(outcome(doc, null, ctx(editAnyRoles))).toBeNull();
    });

    it('a blocked attachment is refused before roles are consulted', () => {
      const doc = attachmentDoc({att1: stub('text/html')});
      // No roles at all, yet the error is the content gate, not a role error.
      expectForbiddenContent(outcome(doc, null, ctx([])), 'text/html');
    });
  });
});
