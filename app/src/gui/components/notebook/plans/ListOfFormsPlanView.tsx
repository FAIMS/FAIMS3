import {LIST_OF_FORMS_PLAN_TYPE, planReferenceFor} from '@faims3/data-model';
import {Alert} from '@mui/material';
import {useMemo} from 'react';
import {config} from '../../../../buildconfig';
import {ListOfFormsView} from '../ListOfFormsView';
import {NotebookViewComponentProps} from '../types';

/**
 * A view component for the list of forms plan type: the list of forms view
 * configured from the forms the plan names, with records it creates claimed
 * for the plan.
 */
export const ListOfFormsPlanView = (props: NotebookViewComponentProps) => {
  const {uiSpecification} = props;

  // The notebook may carry several plans, so the one to render arrives in
  // props rather than being read back off the project.
  const plan =
    props.plan?.planType === LIST_OF_FORMS_PLAN_TYPE ? props.plan : undefined;
  const formTypes = useMemo(() => plan?.formTypes ?? [], [plan]);

  if (!plan) {
    return (
      <div>
        ListOfFormsPlanView: Not a list of forms plan for this{' '}
        {config.notebookName}
      </div>
    );
  }

  const formLabels = formTypes
    .map(type => uiSpecification.viewsets[type]?.label || type)
    .join(', ');

  return (
    <>
      {/* The plan's label leads, since the plan type names nothing a user
      has seen */}
      <Alert severity="info">
        <b>{plan.label}</b>: create and browse {formLabels} records.
        {/* A notebook with one plan never shows the chooser, so this is the
        only place its description is read */}
        {plan.description && <div>{plan.description}</div>}
      </Alert>
      <ListOfFormsView
        {...props}
        formTypes={formTypes}
        planReference={planReferenceFor({planId: plan.planId})}
      />
    </>
  );
};
