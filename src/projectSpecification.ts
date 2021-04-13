import {getProjectDB} from './sync/index';
import {PROJECT_SPECIFICATION_PREFIX, ProjectSchema} from './datamodel';

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
  if (splitname.length !== 2) {
    throw Error('Not a valid type name');
  }
  return {namespace: splitname[0], name: splitname[1]};
}

export async function lookupFAIMSType(faimsType: string, context: TypeContext) {
  if (context.use_cache && typeCache.has(faimsType)) {
    return typeCache.get(faimsType);
  }
  const parsedName = parseTypeName(faimsType);
  let refVal;
  if (FAIMS_NAMESPACES.includes(parsedName['namespace'])) {
    refVal = lookupBuiltinReference(
      parsedName,
      context,
      ProjectSpecOptions.types
    );
  } else {
    refVal = lookupProjectReference(
      parsedName,
      context,
      ProjectSpecOptions.types
    );
  }
  typeCache.set(faimsType, refVal);
  return refVal;
}

export async function lookupFAIMSConstant(
  faimsConst: string,
  context: TypeContext
) {
  if (context.use_cache && constantCache.has(faimsConst)) {
    return constantCache.get(faimsConst);
  }
  const parsedName = parseTypeName(faimsConst);
  let refVal;
  if (FAIMS_NAMESPACES.includes(parsedName['namespace'])) {
    refVal = lookupBuiltinReference(
      parsedName,
      context,
      ProjectSpecOptions.constants
    );
  } else {
    refVal = lookupProjectReference(
      parsedName,
      context,
      ProjectSpecOptions.constants
    );
  }
  constantCache.set(faimsConst, refVal);
  return refVal;
}

async function lookupBuiltinReference(
  faimsType: TypeReference,
  context: TypeContext,
  specOpt: ProjectSpecOptions
) {
  return {};
}

async function lookupProjectReference(
  faimsRef: TypeReference,
  context: TypeContext,
  specOpt: ProjectSpecOptions
) {
  const project_name = context.project_name;
  const projdb = getProjectDB(project_name);
  try {
    const specdoc: ProjectSchema = await projdb.get(
      PROJECT_SPECIFICATION_PREFIX + '-' + faimsRef['namespace']
    );
    if (specdoc.namespace !== faimsRef['namespace']) {
      throw Error('namespace names do not match!');
    }
    if (specOpt === ProjectSpecOptions.constants) {
      return specdoc.constants[faimsRef['name']];
    } else if (specOpt === ProjectSpecOptions.types) {
      return parseTypeInformation(specdoc.types[faimsRef['name']], context);
    }
    throw Error('Unsupported option, implementation needed');
  } catch (err) {
    console.log(err);
    throw Error('failed to look up reference');
  }
}

function parseTypeInformation(typeInfo: any, context: TypeContext) {
  const supertypes = typeInfo['super-types'];
  const computedProps = supertypes.map((name: string) => {
    return lookupFAIMSType(name, context);
  });
  computedProps.append(typeInfo);
  return compressTypes(computedProps);
}

function compressTypes(typeInfo: any) {
  let allowedValues = [];
  const members = [];
  const constraints = [];
  for (const typ of typeInfo) {
    if (typ['allowed-values'] !== undefined) {
      allowedValues = typ['allowed-values'];
    }
    if (typ['additional-members'] !== undefined) {
      members.push(...typ['additional-members']);
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
