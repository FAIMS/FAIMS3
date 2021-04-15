import {getProjectDB} from './sync/index';
import {
  PROJECT_SPECIFICATION_PREFIX,
  ProjectSchema,
  FAIMSType,
} from './datamodel';

export const FAIMS_NAMESPACES = [
  'faims-core',
  'faims-user',
  'faims-pos',
  'faims-attach',
  'faims-person',
];

const typeCache = new Map();
const constantCache = new Map();

interface TypeReference {
  namespace: string;
  name: string;
}

interface TypeContext {
  project_name: string;
  use_cache: boolean;
}

enum ProjectSpecOptions {
  types = 'types',
  constants = 'constants',
}

export function createTypeContext(
  project_name: string,
  use_cache = true
): TypeContext {
  return {
    project_name: project_name,
    use_cache: use_cache,
  };
}

export function parseTypeName(typename: string): TypeReference {
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

export async function lookupFAIMSType(faimsType: string, context: TypeContext) {
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
    console.warn(err);
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
  faimsType: TypeReference,
  context: TypeContext,
  specOpt: ProjectSpecOptions
) {
  return {};
}

async function getOrCreateSpecDoc(
  project_name: string,
  namespace: string
): Promise<ProjectSchema> {
  const projdb = getProjectDB(project_name);
  try {
    const specdoc: ProjectSchema = await projdb.get(
      PROJECT_SPECIFICATION_PREFIX + '-' + namespace
    );
    if (specdoc.namespace !== namespace) {
      throw Error('namespace names do not match!');
    }
    return specdoc;
  } catch (err) {
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
) {
  const project_name = context.project_name;
  try {
    const specdoc = await getOrCreateSpecDoc(
      project_name,
      faimsRef['namespace']
    );
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
  const constraints = [];
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
  const project_name = context.project_name;
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

  let specdoc;
  try {
    specdoc = await getOrCreateSpecDoc(project_name, parsedName['namespace']);
    specdoc.types[parsedName['name']] = validatedInfo;
  } catch (err) {
    console.warn(err);
    throw Error('failed to get document');
  }

  const projdb = getProjectDB(project_name);
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
  const project_name = context.project_name;
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

  const specdoc = await getOrCreateSpecDoc(
    project_name,
    parsedName['namespace']
  );
  specdoc.constants[parsedName['name']] = validatedInfo;

  const projdb = getProjectDB(project_name);
  try {
    return projdb.put(specdoc);
  } catch (err) {
    console.warn(err);
    throw Error('Failed to add constant');
  }
}

function allowedProjectSpecUpsertPermissions(
  name: TypeReference,
  context: TypeContext
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
