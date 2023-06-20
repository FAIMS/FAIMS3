/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: projectSpecification.test.js
 * Description:
 *   TODO
 */

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
import {ProjectID} from 'faims3-datamodel';
import {equals} from './utils/eqTestSupport';

PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adapter for testing

const projdbs: any = {};

async function mockProjectDB(project_id: ProjectID) {
  if (projdbs[project_id] === undefined) {
    const db = new PouchDB(project_id, {adapter: 'memory'});
    projdbs[project_id] = db;
  }
  return projdbs[project_id];
}

async function cleanProjectDBS() {
  let db;
  for (const project_id in projdbs) {
    db = projdbs[project_id];
    delete projdbs[project_id];

    if (db !== undefined) {
      try {
        const alldocsIgnored = await db.allDocs({include_docs: true});
        await db.destroy();
        // await db.close();
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
  project_id => {
    return createTypeContext(project_id).use_cache;
  }
);

testProp(
  'type context project name is set',
  [fc.fullUnicodeString()],
  project_id => {
    return createTypeContext(project_id).project_id === project_id;
  }
);

testProp(
  'type context cache is set',
  [fc.fullUnicodeString(), fc.boolean()],
  (project_id, use_cache) => {
    return createTypeContext(project_id, use_cache).use_cache === use_cache;
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

describe.skip('roundtrip reading and writing to db', () => {
  testProp(
    'types roundtrip',
    [
      fc.fullUnicodeString(),
      fc.fullUnicodeString(),
      fc.fullUnicodeString(),
      fc.array(fc?.unicodeJsonValue()), // allowed-values
      fc.dictionary(fc.fullUnicodeString(), fc.unicodeJsonValue()), // additional-members
      fc.array(fc.unicodeJsonValue()), // additional-constraints
    ],
    async (
      project_id,
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
      try {
        await cleanProjectDBS();
      } catch (err) {
        console.error(err);
        fail('Failed to clean dbs');
      }
      fc.pre(Object.keys(projdbs).length > 0);

      const fulltype = namespace + '::' + name;
      const context = createTypeContext(project_id, false);

      const typeInfo = {
        'allowed-values': allowedValues,
        'additional-members': additionalMembers,
        'additional-constraints': additionalConstraints,
      };

      return upsertFAIMSType(fulltype, typeInfo, context)
        .then(_result => {
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
      fc.dictionary(fc.fullUnicodeString(), fc.unicodeJson()),
    ],
    async (project_id, namespace, name, constInfo) => {
      fc.pre(!namespace.includes(':'));
      fc.pre(!name.includes(':'));
      fc.pre(namespace.trim() !== '');
      fc.pre(name.trim() !== '');
      try {
        await cleanProjectDBS();
      } catch (err) {
        console.error(err);
        fail('Failed to clean dbs');
      }
      fc.pre(Object.keys(projdbs).length > 0);

      const fullconst = namespace + '::' + name;
      const context = createTypeContext(project_id, false);

      return upsertFAIMSConstant(fullconst, constInfo, context)
        .then(_result => {
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
      fc.array(fc.unicodeJson()), // allowed-values
      fc.dictionary(fc.fullUnicodeString(), fc.unicodeJson()), // additional-members
      fc.array(fc.unicodeJson()), // additional-constraints
    ],
    async (
      project_id,
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
      try {
        await cleanProjectDBS();
      } catch (err) {
        console.error(err);
        fail('Failed to clean dbs');
      }
      clearAllCaches();
      fc.pre(Object.keys(projdbs).length > 0);

      const fulltype = namespace + '::' + name;
      const context = createTypeContext(project_id);

      const typeInfo = {
        'allowed-values': allowedValues,
        'additional-members': additionalMembers,
        'additional-constraints': additionalConstraints,
      };

      return upsertFAIMSType(fulltype, typeInfo, context)
        .then(_result => {
          return lookupFAIMSType(fulltype, context);
        })
        .then(result => expect(equals(result, typeInfo)).toBe(true))
        .then(_result => {
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
      fc.dictionary(fc.fullUnicodeString(), fc.unicodeJsonValue()),
    ],
    async (project_id, namespace, name, constInfo) => {
      fc.pre(!namespace.includes(':'));
      fc.pre(!name.includes(':'));
      fc.pre(namespace.trim() !== '');
      fc.pre(name.trim() !== '');
      try {
        await cleanProjectDBS();
      } catch (err) {
        console.error(err);
        fail('Failed to clean dbs');
      }
      clearAllCaches();
      fc.pre(Object.keys(projdbs).length > 0);

      const fullconst = namespace + '::' + name;
      const context = createTypeContext(project_id);

      return upsertFAIMSConstant(fullconst, constInfo, context)
        .then(_result => {
          return lookupFAIMSConstant(fullconst, context);
        })
        .then(result => expect(equals(result, constInfo)).toBe(true))
        .then(_result => {
          return lookupFAIMSConstant(fullconst, context);
        })
        .then(result => expect(equals(result, constInfo)).toBe(true));
    }
  );
});
