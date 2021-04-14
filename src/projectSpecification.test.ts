import {testProp, fc} from 'jest-fast-check';
import PouchDB from 'pouchdb';
import {
  createTypeContext,
  parseTypeName,
  lookupFAIMSType,
  upsertFAIMSType,
  lookupFAIMSConstant,
  upsertFAIMSConstant,
} from './projectSpecification';

import {getProjectDB} from './sync/index';

PouchDB.plugin(require('pouchdb-adapter-memory')); // enable memory adaptor for testing

function mockProjectDB(project_name: string) {
  return new PouchDB(project_name, {adapter: 'memory'});
}

jest.mock('./sync/index', () => ({
  getProjectDB: mockProjectDB,
}));

testProp('type context caches by default', [fc.string()], project_name => {
  return createTypeContext(project_name).use_cache;
});

testProp('type context project name is set', [fc.string()], project_name => {
  return createTypeContext(project_name).project_name === project_name;
});

testProp(
  'type context cache is set',
  [fc.string(), fc.boolean()],
  (project_name, use_cache) => {
    return createTypeContext(project_name, use_cache).use_cache === use_cache;
  }
);

testProp('unnamespaced type errors', [fc.string()], name => {
  fc.pre(!name.includes('::'));
  expect(() => parseTypeName(name)).toThrow('Not a valid type name');
});

testProp(
  'namespaced type works',
  [fc.string(), fc.string()],
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

testProp(
  'types roundtrip',
  [
    fc.string(),
    fc.string(),
    fc.string(),
    fc.array(fc.anything()), // allowed-values
    fc.dictionary(fc.string(), fc.jsonObject()), // additional-members
    fc.dictionary(fc.string(), fc.jsonObject()), // additional-constraints
  ],
  (
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

    const fulltype = namespace + '::' + name;
    const context = createTypeContext(project_name);

    const typeInfo = {
      'allowed-values': allowedValues,
      'additional-members': additionalMembers,
      'additional-constraints': additionalConstraints,
    };

    return upsertFAIMSType(fulltype, typeInfo, context)
      .then(result => lookupFAIMSType(fulltype, context))
      .then(result => expect(result).toBe(typeInfo));
  }
);
