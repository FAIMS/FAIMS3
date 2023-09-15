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
 * Filename: projectSpecification.ts
 * Description:
 *   TODO
 */

import {getProjectDB} from './sync/index';
import PouchDB from 'pouchdb-browser';
import {ProjectID, FAIMSTypeName} from 'faims3-datamodel';
import {PROJECT_SPECIFICATION_PREFIX, ProjectSchema} from 'faims3-datamodel';
import {FAIMSType, FAIMSConstant} from 'faims3-datamodel';

export const FAIMS_NAMESPACES = [
  'faims-core',
  'faims-user',
  'faims-pos',
  'faims-attach',
  'faims-person',
];

const typeCache = new Map<string, FAIMSType>();
const constantCache = new Map<string, FAIMSConstant>();

interface TypeReference {
  namespace: string;
  name: string;
}

interface TypeContext {
  project_id: ProjectID;
  use_cache: boolean;
}

enum ProjectSpecOptions {
  types = 'types',
  constants = 'constants',
}

export function createTypeContext(
  project_id: ProjectID,
  use_cache = true
): TypeContext {
  return {
    project_id: project_id,
    use_cache: use_cache,
  };
}

export function parseTypeName(typename: FAIMSTypeName): TypeReference {
  const splitname = typename.split('::');
  if (
    splitname.length !== 2 ||
    splitname[0].trim() === '' ||
    splitname[0].includes(':') ||
    splitname[1].trim() === '' ||
    splitname[1].includes(':')
  ) {
    throw Error('Not a valid type name');
  }
  return {namespace: splitname[0], name: splitname[1]};
}

export async function lookupFAIMSType(
  faimsType: FAIMSTypeName,
  context: TypeContext
) {
  if (context.use_cache && typeCache.has(faimsType)) {
    return typeCache.get(faimsType);
  }
  const parsedName = parseTypeName(faimsType);
  try {
    let refVal;
    if (FAIMS_NAMESPACES.includes(parsedName['namespace'])) {
      refVal = await lookupBuiltinReference(
        parsedName,
        context,
        ProjectSpecOptions.types
      );
    } else {
      refVal = await lookupProjectReference(
        parsedName,
        context,
        ProjectSpecOptions.types
      );
    }
    typeCache.set(faimsType, refVal);
    return refVal;
  } catch (err) {
    console.warn('Failed to look up type', err);
    throw Error('failed to look up type');
  }
}

export async function lookupFAIMSConstant(
  faimsConst: string,
  context: TypeContext
) {
  if (context.use_cache && constantCache.has(faimsConst)) {
    return constantCache.get(faimsConst);
  }
  const parsedName = parseTypeName(faimsConst);
  try {
    let refVal;
    if (FAIMS_NAMESPACES.includes(parsedName['namespace'])) {
      refVal = await lookupBuiltinReference(
        parsedName,
        context,
        ProjectSpecOptions.constants
      );
    } else {
      refVal = await lookupProjectReference(
        parsedName,
        context,
        ProjectSpecOptions.constants
      );
    }
    constantCache.set(faimsConst, refVal);
    return refVal;
  } catch (err) {
    console.warn(err);
    throw Error('failed to look up constant');
  }
}

async function lookupBuiltinReference(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _faimsType: TypeReference,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _context: TypeContext,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _specOpt: ProjectSpecOptions
) {
  return {};
}

async function getOrCreateSpecDoc(
  project_id: ProjectID,
  namespace: string
): Promise<ProjectSchema & PouchDB.Core.IdMeta> {
  const projdb = await getProjectDB(project_id);
  try {
    const specdoc = (await projdb.get(
      PROJECT_SPECIFICATION_PREFIX + '-' + namespace
    )) as PouchDB.Core.ExistingDocument<ProjectSchema>;
    if (specdoc.namespace !== namespace) {
      throw Error('namespace names do not match!');
    }
    return specdoc;
  } catch (err: any) {
    if (err.status === 404) {
      return {
        _id: PROJECT_SPECIFICATION_PREFIX + '-' + namespace,
        namespace: namespace,
        types: {},
        constants: {},
      };
    }
    throw Error(err);
  }
}

async function lookupProjectReference(
  faimsRef: TypeReference,
  context: TypeContext,
  specOpt: ProjectSpecOptions
): Promise<FAIMSConstant | FAIMSType> {
  const project_id = context.project_id;
  try {
    const specdoc = await getOrCreateSpecDoc(project_id, faimsRef['namespace']);
    if (specOpt === ProjectSpecOptions.constants) {
      const refVal = specdoc.constants[faimsRef['name']];
      if (refVal === undefined) {
        throw Error(
          `Constant ${faimsRef['name']} not in ${faimsRef['namespace']}`
        );
      }
      return refVal;
    } else if (specOpt === ProjectSpecOptions.types) {
      const refVal = specdoc.types[faimsRef['name']];
      if (refVal === undefined) {
        throw Error(`Type ${faimsRef['name']} not in ${faimsRef['namespace']}`);
      }
      return parseTypeInformation(refVal, context);
    }
    throw Error('Unsupported option, implementation needed');
  } catch (err) {
    console.warn(err);
    throw Error('failed to look up reference');
  }
}

function parseTypeInformation(
  typeInfo: FAIMSType,
  context: TypeContext
): FAIMSType {
  const supertypes = typeInfo['super-types'];
  let computedProps;
  if (supertypes !== undefined) {
    computedProps = supertypes.map((name: string) => {
      return lookupFAIMSType(name, context);
    });
  } else {
    computedProps = [];
  }
  computedProps.push(typeInfo);
  return compressTypes(computedProps);
}

function compressTypes(typeInfo: Array<FAIMSType>): FAIMSType {
  let allowedValues = [];
  const members = {};
  const constraints: any[] = [];
  for (const typ of typeInfo) {
    if (typ['allowed-values'] !== undefined) {
      allowedValues = typ['allowed-values'];
    }
    if (typ['additional-members'] !== undefined) {
      Object.assign(members, typ['additional-members']);
    }
    if (typ['additional-constraints'] !== undefined) {
      constraints.push(...typ['additional-constraints']);
    }
  }
  return {
    'allowed-values': allowedValues,
    'additional-members': members,
    'additional-constraints': constraints,
  };
}

export async function upsertFAIMSType(
  qualname: string,
  typeInfo: FAIMSType,
  context: TypeContext
) {
  const project_id = context.project_id;
  const parsedName = parseTypeName(qualname);

  if (!allowedProjectSpecUpsertPermissions(parsedName, context)) {
    throw Error(`Not allowed to create or modify ${qualname}`);
  }

  let validatedInfo;
  try {
    validatedInfo = await validateTypeInfo(typeInfo);
  } catch (err) {
    console.warn(err);
    throw Error('invalid type information');
  }

  let specdoc: ProjectSchema & PouchDB.Core.IdMeta;
  try {
    specdoc = await getOrCreateSpecDoc(project_id, parsedName['namespace']);
    specdoc.types[parsedName['name']] = validatedInfo;
  } catch (err) {
    console.warn(err);
    throw Error('failed to get document');
  }

  const projdb = await getProjectDB(project_id);
  try {
    return projdb.put(specdoc);
  } catch (err) {
    console.warn(err);
    throw Error('Failed to add type');
  }
}

export async function upsertFAIMSConstant(
  qualname: string,
  constInfo: any,
  context: TypeContext
) {
  const project_id = context.project_id;
  const parsedName = parseTypeName(qualname);

  if (!allowedProjectSpecUpsertPermissions(parsedName, context)) {
    throw Error(`Not allowed to create or modify ${qualname}`);
  }

  let validatedInfo;
  try {
    validatedInfo = await validateConstInfo(constInfo);
  } catch (err) {
    console.warn(err);
    throw Error('invalid type information');
  }

  const specdoc = await getOrCreateSpecDoc(project_id, parsedName['namespace']);
  specdoc.constants[parsedName['name']] = validatedInfo;

  const projdb = await getProjectDB(project_id);
  try {
    return projdb.put(specdoc);
  } catch (err) {
    console.warn(err);
    throw Error('Failed to add constant');
  }
}

function allowedProjectSpecUpsertPermissions(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _name: TypeReference,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _context: TypeContext
): boolean {
  // Not implemented yet
  return true;
}

async function validateTypeInfo(typeInfo: FAIMSType) {
  // Not implemented yet
  return typeInfo;
}

async function validateConstInfo(constInfo: any) {
  // Not implemented yet
  return constInfo;
}

function clearTypeCache() {
  typeCache.clear();
}

function clearConstantCache() {
  constantCache.clear();
}

export function clearAllCaches() {
  clearTypeCache();
  clearConstantCache();
}
