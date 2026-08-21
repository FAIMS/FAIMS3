import {COUNTED_PLAN_TYPE, CountedPlan} from '@faims3/data-model';
import {Alert, Box, Tab} from '@mui/material';
import AddRecordButtons from '../add_record_by_type';
import {RecordsTable} from '../record_table';
import {NotebookViewComponentProps} from '../types';
import TabPanel from '@mui/lab/TabPanel';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import {useState} from 'react';

/**
 * A view component for the counted plan type. Shows the record
 * list and allows creation of records up to the number required by the plan.
 *
 */

export const CountedPlanView = (props: NotebookViewComponentProps) => {
  const {project, uiSpecification, records, actions, status} = props;

  const [tabIndex, setTabIndex] = useState('0');

  // Should not need this but it guards the type cast below
  if (project.uiDefinition?.plan?.planType !== COUNTED_PLAN_TYPE) {
    return <div>CountedPlanView: Not a counted plan</div>;
  }
  // this really is a counted plan
  const plan: CountedPlan = project.uiDefinition.plan as CountedPlan;
  if (!plan) {
    return <div>No plan defined for this notebook</div>;
  }

  // How many records of the target type have we got
  const targetRecordCount = records.allRecords.filter(
    record => record.type === plan.formType
  ).length;

  // We can add records if the user has permission and we've not reached the target number
  // Note that this doesn't prevent their being more than the target number of records
  // because another user could be adding them at the same time. So, the plan is really
  // just a workflow guide rather than an enforced constraint on the data collected.
  const showAddRecordButtons =
    status.isAllowedToAddRecords &&
    (targetRecordCount < plan.numberRequired || plan.allowExtraRecords);

  // recordLabel based on viewsets
  const recordLabel =
    uiSpecification.visible_types?.length === 1
      ? uiSpecification.viewsets[uiSpecification.visible_types[0]]?.label ||
        uiSpecification.visible_types[0]
      : 'Record';

  return (
    <>
      <div>
        <Alert severity="info">
          <b>Counted Plan</b>: Collect {plan.numberRequired} {plan.formType}{' '}
          records.{' '}
          {!plan.allowExtraRecords
            ? 'Do not allow extra records'
            : 'Extra records allowed'}
        </Alert>
      </div>

      <TabContext value={tabIndex.toString()}>
        <TabList
          onChange={(event, newValue) => setTabIndex(newValue)}
          aria-label={`List of Records Plan tabs`}
        >
          <Tab
            label={`Planned ${recordLabel}s`}
            value="0"
            id="planned-tab"
            aria-controls="planned-tabpanel"
          />

          <Tab
            value="1"
            label={`Details`}
            id="details-tab"
            aria-controls="details-tabpanel"
          />
          <Tab
            value="2"
            label={`Settings`}
            id="settings-tab"
            aria-controls="settings-tabpanel"
          />
        </TabList>

        <TabPanel value="0" id="planned-tabpanel" aria-labelledby="planned-tab">
          {showAddRecordButtons && (
            <Box sx={{mb: 1.5}}>
              <AddRecordButtons
                project={project}
                recordLabel={recordLabel}
                refreshList={actions.refreshRecordList}
              />
            </Box>
          )}
          {!showAddRecordButtons && (
            <Alert severity="info">Target number of records reached.</Alert>
          )}

          <RecordsTable
            project={project}
            maxRows={25}
            rows={records.allRecords ?? []}
            loading={status.isLoading}
            viewsets={uiSpecification.viewsets}
            handleQueryFunction={actions.setQuery}
            handleRefresh={() => {}} // Note this is not used in RecordsTable
            recordLabel={recordLabel}
            recordStatus={records.syncStatus}
          />
        </TabPanel>

        <TabPanel value="1" id="details-tabpanel" aria-labelledby="details-tab">
          <props.components.MetadataDisplayComponent />
        </TabPanel>

        <TabPanel
          value="2"
          id="settings-tabpanel"
          aria-labelledby="settings-tab"
        >
          <props.components.NotebookSettings />
        </TabPanel>
      </TabContext>
    </>
  );
};
