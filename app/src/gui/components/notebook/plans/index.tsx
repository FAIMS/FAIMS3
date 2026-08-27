import {COUNTED_PLAN_TYPE, LIST_OF_RECORDS_PLAN_TYPE} from '@faims3/data-model';
import {CountedPlanView} from './CountedPlanView';
import {registerNotebookView} from './planViewRegistry';
import {ListOfRecordsPlanView} from './ListOfRecordsPlanView';

registerNotebookView(COUNTED_PLAN_TYPE, CountedPlanView);
registerNotebookView(LIST_OF_RECORDS_PLAN_TYPE, ListOfRecordsPlanView);

export * from './planViewRegistry';
export * from './PlanSwitcher';
export * from './resolvePlanViews';
