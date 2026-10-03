import {countedPlanDefinition} from './countedPlan';
import {listOfFormsPlanDefinition} from './listOfFormsPlan';
import {listOfRecordsPlanDefinition} from './listOfRecordsPlan';

export const builtInPlanTypes = [
  countedPlanDefinition,
  listOfRecordsPlanDefinition,
  listOfFormsPlanDefinition,
] as const;
