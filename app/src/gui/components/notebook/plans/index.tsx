import {
  COUNTED_PLAN_TYPE,
  LIST_OF_FORMS_PLAN_TYPE,
  LIST_OF_RECORDS_PLAN_TYPE,
} from '@faims3/data-model';
import {CountedPlanView} from './CountedPlanView';
import {ListOfFormsPlanView} from './ListOfFormsPlanView';
import {registerNotebookView} from './planViewRegistry';
import {ListOfRecordsPlanView} from './ListOfRecordsPlanView';

registerNotebookView(COUNTED_PLAN_TYPE, CountedPlanView);
registerNotebookView(LIST_OF_RECORDS_PLAN_TYPE, ListOfRecordsPlanView);
registerNotebookView(LIST_OF_FORMS_PLAN_TYPE, ListOfFormsPlanView);

export * from './planViewRegistry';
export * from './PlanChooser';
export * from './resolvePlanViews';
