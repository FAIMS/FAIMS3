/**
 * @file Registry of plan configuration forms shown when a notebook is created
 * from a template with plan templates. Mirrors the designer's plan registry
 * (designer/plans.tsx) and data-model's runtime registry: a Map with lazy
 * built-in installation so external plan modules can register their own.
 */

import {COUNTED_PLAN_TYPE, LIST_OF_RECORDS_PLAN_TYPE} from '@faims3/data-model';
import {countedPlanConfig, countedPlanFields} from './countedPlanFields';
import {ListOfRecordsPlanConfigForm} from './ListOfRecordsPlanConfigForm';
import type {PlanConfigType} from './types';

export * from './types';

export type PlanConfigRegistry = Map<string, PlanConfigType>;

export const createPlanConfigRegistry = (): PlanConfigRegistry => new Map();

// Default registry used at runtime; injectable for testing, as in data-model
const defaultRegistry = createPlanConfigRegistry();
let builtInsInstalled = false;

export const registerPlanConfigType = (
  definition: PlanConfigType,
  registry: PlanConfigRegistry = defaultRegistry
) => {
  if (registry.has(definition.planType)) {
    throw new Error(
      `Plan config type ${definition.planType} is already registered`
    );
  }
  registry.set(definition.planType, definition);
};

const builtInPlanConfigTypes: PlanConfigType[] = [
  {
    planType: COUNTED_PLAN_TYPE,
    label: 'Counted',
    fields: countedPlanFields,
    toConfig: countedPlanConfig,
  },
  {
    planType: LIST_OF_RECORDS_PLAN_TYPE,
    label: 'List of Records',
    ConfigForm: ListOfRecordsPlanConfigForm,
  },
];

// Built-ins install lazily on first lookup, matching data-model's registry
const installBuiltIns = (registry: PlanConfigRegistry) => {
  if (registry === defaultRegistry && builtInsInstalled) return;
  builtInPlanConfigTypes.forEach(d => registerPlanConfigType(d, registry));
  if (registry === defaultRegistry) builtInsInstalled = true;
};

export const getPlanConfigType = (
  planType: string,
  registry: PlanConfigRegistry = defaultRegistry
): PlanConfigType | undefined => {
  if (registry === defaultRegistry) installBuiltIns(registry);
  return registry.get(planType);
};
