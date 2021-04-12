import {getProjectDB} from './sync/index';
import {PROJECT_SPECIFICATION_PREFIX, ProjectSchema} from './datamodel';

export const FAIMS_NAMESPACES = [
  'faims-core',
  'faims-user',
  'faims-pos',
  'faims-attach',
  'faims-person',
];

export function parseTypeName(typename: string) {
  const splitname = typename.split('::');
  if (splitname.length !== 2) {
    throw Error('Not a valid type name');
  }
  return {namespace: splitname[0], name: splitname[1]};
}

export async function lookupFAIMSType(faimsType: string, context: any) {
  const parsedName = parseTypeName(faimsType);
  if (FAIMS_NAMESPACES.includes(parsedName['namespace'])) {
    return lookupBuiltinFAIMSType(parsedName, context);
  }
  return lookupProjectFAIMSType(parsedName, context);
}

async function lookupBuiltinFAIMSType(faimsType: any, context: any) {
  return {};
}

async function lookupProjectFAIMSType(faimsType: any, context: any) {
  const project_name = context.project_name;
  const projdb = getProjectDB(project_name);
  try {
    const specdoc: ProjectSchema = await projdb.get(
      PROJECT_SPECIFICATION_PREFIX + '-' + faimsType['namespace']
    );
    if (specdoc.namespace !== faimsType['namespace']) {
      throw Error('namespace names do not match!');
    }
    return parseTypeInformation(specdoc.types[faimsType['name']], context);
  } catch (err) {
    console.log(err);
    throw Error('failed to look up type');
  }
}

function parseTypeInformation(typeInfo: any, context: any) {
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
