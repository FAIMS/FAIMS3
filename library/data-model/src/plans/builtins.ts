import {countedPlanDefinition} from './countedPlan';
import {listOfRecordsPlanDefinition} from './listOfRecordsPlan';

export const builtInPlanTypes = [
  countedPlanDefinition,
  listOfRecordsPlanDefinition,
] as const;
