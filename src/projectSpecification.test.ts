import {testProp, fc} from 'jest-fast-check';
import PouchDB from 'pouchdb';
import {
  createTypeContext,
  parseTypeName,
  lookupFAIMSType,
  upsertFAIMSType,
  lookupFAIMSConstant,
  upsertFAIMSConstant,
  clearAllCaches,
} from './projectSpecification';
import {equals} from './utils/eqTestSupport';

import {getProjectDB} from './sync/index';

PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adaptor for testing

const projdbs: any = {};

function mockProjectDB(project_name: string) {
  if (projdbs[project_name] === undefined) {
    const db = new PouchDB(project_name, {adapter: 'memory'});
    projdbs[project_name] = db;
  }
  return projdbs[project_name];
}

async function cleanProjectDBS() {
  let db;
  for (const project_name in projdbs) {
    db = projdbs[project_name];
    delete projdbs[project_name];

    if (db !== undefined) {
      try {
        const alldocs = await db.allDocs({include_docs: true});
        await db.destroy();
        //await db.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
}

jest.mock('./sync/index', () => ({
  getProjectDB: mockProjectDB,
}));

testProp(
  'type context caches by default',
  [fc.fullUnicodeString()],
  project_name => {
    return createTypeContext(project_name).use_cache;
  }
);

testProp(
  'type context project name is set',
  [fc.fullUnicodeString()],
  project_name => {
    return createTypeContext(project_name).project_name === project_name;
  }
);

testProp(
  'type context cache is set',
  [fc.fullUnicodeString(), fc.boolean()],
  (project_name, use_cache) => {
    return createTypeContext(project_name, use_cache).use_cache === use_cache;
  }
);

testProp('unnamespaced type errors', [fc.fullUnicodeString()], name => {
  fc.pre(!name.includes('::'));
  expect(() => parseTypeName(name)).toThrow('Not a valid type name');
});

testProp(
  'namespaced type works',
  [fc.fullUnicodeString(), fc.fullUnicodeString()],
  (namespace, name) => {
    fc.pre(!namespace.includes(':'));
    fc.pre(!name.includes(':'));
    fc.pre(namespace.trim() !== '');
    fc.pre(name.trim() !== '');

    const fulltype = namespace + '::' + name;

    const parsedType = parseTypeName(fulltype);

    expect(parsedType.namespace).toEqual(namespace);
    expect(parsedType.name).toEqual(name);
  }
);

describe('roundtrip reading and writing to db', () => {
  testProp(
    'types roundtrip',
    [
      fc.fullUnicodeString(),
      fc.fullUnicodeString(),
      fc.fullUnicodeString(),
      fc.array(fc.unicodeJsonObject()), // allowed-values
      fc.dictionary(fc.fullUnicodeString(), fc.unicodeJsonObject()), // additional-members
      fc.array(fc.unicodeJsonObject()), // additional-constraints
    ],
    async (
      project_name,
      namespace,
      name,
      allowedValues,
      additionalMembers,
      additionalConstraints
    ) => {
      fc.pre(!namespace.includes(':'));
      fc.pre(!name.includes(':'));
      fc.pre(namespace.trim() !== '');
      fc.pre(name.trim() !== '');
      await cleanProjectDBS();
      fc.pre(projdbs !== {});

      const fulltype = namespace + '::' + name;
      const context = createTypeContext(project_name, false);

      const typeInfo = {
        'allowed-values': allowedValues,
        'additional-members': additionalMembers,
        'additional-constraints': additionalConstraints,
      };

      return upsertFAIMSType(fulltype, typeInfo, context)
        .then(result => {
          return lookupFAIMSType(fulltype, context);
        })
        .then(result => expect(equals(result, typeInfo)).toBe(true));
    }
  );
  testProp(
    'constants roundtrip',
    [
      fc.fullUnicodeString(),
      fc.fullUnicodeString(),
      fc.fullUnicodeString(),
      fc.dictionary(fc.fullUnicodeString(), fc.unicodeJsonObject()),
    ],
    async (project_name, namespace, name, constInfo) => {
      fc.pre(!namespace.includes(':'));
      fc.pre(!name.includes(':'));
      fc.pre(namespace.trim() !== '');
      fc.pre(name.trim() !== '');
      await cleanProjectDBS();
      fc.pre(projdbs !== {});

      const fullconst = namespace + '::' + name;
      const context = createTypeContext(project_name, false);

      return upsertFAIMSConstant(fullconst, constInfo, context)
        .then(result => {
          return lookupFAIMSConstant(fullconst, context);
        })
        .then(result => expect(equals(result, constInfo)).toBe(true));
    }
  );
  testProp(
    'types roundtrip with caching',
    [
      fc.fullUnicodeString(),
      fc.fullUnicodeString(),
      fc.fullUnicodeString(),
      fc.array(fc.unicodeJsonObject()), // allowed-values
      fc.dictionary(fc.fullUnicodeString(), fc.unicodeJsonObject()), // additional-members
      fc.array(fc.unicodeJsonObject()), // additional-constraints
    ],
    async (
      project_name,
      namespace,
      name,
      allowedValues,
      additionalMembers,
      additionalConstraints
    ) => {
      fc.pre(!namespace.includes(':'));
      fc.pre(!name.includes(':'));
      fc.pre(namespace.trim() !== '');
      fc.pre(name.trim() !== '');
      await cleanProjectDBS();
      clearAllCaches();
      fc.pre(projdbs !== {});

      const fulltype = namespace + '::' + name;
      const context = createTypeContext(project_name);

      const typeInfo = {
        'allowed-values': allowedValues,
        'additional-members': additionalMembers,
        'additional-constraints': additionalConstraints,
      };

      return upsertFAIMSType(fulltype, typeInfo, context)
        .then(result => {
          return lookupFAIMSType(fulltype, context);
        })
        .then(result => expect(equals(result, typeInfo)).toBe(true))
        .then(result => {
          return lookupFAIMSType(fulltype, context);
        })
        .then(result => expect(equals(result, typeInfo)).toBe(true));
    }
  );
  testProp(
    'constants roundtrip with caching',
    [
      fc.fullUnicodeString(),
      fc.fullUnicodeString(),
      fc.fullUnicodeString(),
      fc.dictionary(fc.fullUnicodeString(), fc.unicodeJsonObject()),
    ],
    async (project_name, namespace, name, constInfo) => {
      fc.pre(!namespace.includes(':'));
      fc.pre(!name.includes(':'));
      fc.pre(namespace.trim() !== '');
      fc.pre(name.trim() !== '');
      await cleanProjectDBS();
      clearAllCaches();
      fc.pre(projdbs !== {});

      const fullconst = namespace + '::' + name;
      const context = createTypeContext(project_name);

      return upsertFAIMSConstant(fullconst, constInfo, context)
        .then(result => {
          return lookupFAIMSConstant(fullconst, context);
        })
        .then(result => expect(equals(result, constInfo)).toBe(true))
        .then(result => {
          return lookupFAIMSConstant(fullconst, context);
        })
        .then(result => expect(equals(result, constInfo)).toBe(true));
    }
  );
});
