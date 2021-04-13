import {testProp, fc} from 'jest-fast-check';
import projectSpecification from './projectSpecification';
import {createTypeContext, lookupFAIMSType} from './projectSpecification';

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
