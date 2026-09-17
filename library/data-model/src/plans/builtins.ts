import {countedPlanDefinition} from './countedPlan';
import {listOfFormsPlanDefinition} from './listOfFormsPlan';
import {listOfRecordsPlanDefinition} from './listOfRecordsPlan';
import {mapCollectionPlanDefinition} from './mapCollectionPlan';

export const builtInPlanTypes = [
  countedPlanDefinition,
  listOfRecordsPlanDefinition,
  listOfFormsPlanDefinition,
  mapCollectionPlanDefinition,
] as const;
