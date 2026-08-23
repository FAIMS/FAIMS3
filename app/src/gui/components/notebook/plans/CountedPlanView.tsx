import {COUNTED_PLAN_TYPE, CountedPlan} from '@faims3/data-model';
import {Alert, Box, Tab} from '@mui/material';
import AddRecordButtons from '../add_record_by_type';
import {RecordsTable} from '../record_table';
import {resolveTab, SHARED_TAB} from '../../../../constants/routes';
import {NotebookViewComponentProps} from '../types';
import TabPanel from '@mui/lab/TabPanel';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';

// This view's tab slugs, default first
const TABS = ['planned', SHARED_TAB.details, SHARED_TAB.settings] as const;

/**
 * A view component for the counted plan type. Shows the record
 * list and allows creation of records up to the number required by the plan.
 *
 */

export const CountedPlanView = (props: NotebookViewComponentProps) => {
  const {project, tab, uiSpecification, records, actions, status} = props;

  const currentTab = resolveTab(TABS, tab);

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

  // Records that exist may be missing from the list, so the count is a floor
  // rather than the true total and cannot show the target as reached.
  const countMayBeUnderstated =
    !status.canReadAllRecords || status.isDownloadingRecords;

  // We can add records if the user has permission and we've not reached the target number
  // Note that this doesn't prevent their being more than the target number of records
  // because another user could be adding them at the same time. So, the plan is really
  // just a workflow guide rather than an enforced constraint on the data collected.
  const targetReached =
    !countMayBeUnderstated &&
    targetRecordCount >= plan.numberRequired &&
    !plan.allowExtraRecords;

  const showAddRecordButtons = status.isAllowedToAddRecords && !targetReached;

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

      <TabContext value={currentTab}>
        <TabList
          onChange={(event, newValue) => actions.setTab(newValue)}
          aria-label={'Counted Plan tabs'}
        >
          <Tab
            label={`Planned ${recordLabel}s`}
            value="planned"
            id="planned-tab"
            aria-controls="planned-tabpanel"
          />

          <Tab
            value={SHARED_TAB.details}
            label={`Details`}
            id="details-tab"
            aria-controls="details-tabpanel"
          />
          <Tab
            value={SHARED_TAB.settings}
            label={`Settings`}
            id="settings-tab"
            aria-controls="settings-tabpanel"
          />
        </TabList>

        <TabPanel
          value="planned"
          id="planned-tabpanel"
          aria-labelledby="planned-tab"
        >
          {showAddRecordButtons && (
            <Box sx={{mb: 1.5}}>
              <AddRecordButtons
                project={project}
                recordLabel={recordLabel}
                refreshList={actions.refreshRecordList}
              />
            </Box>
          )}
          {countMayBeUnderstated && (
            <Alert severity="warning" sx={{mb: 1.5}}>
              Some records are not visible to you yet, so this plan's progress
              may be further along than it looks.
            </Alert>
          )}
          {targetReached && (
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

        <TabPanel
          value={SHARED_TAB.details}
          id="details-tabpanel"
          aria-labelledby="details-tab"
        >
          <props.components.MetadataDisplayComponent />
        </TabPanel>

        <TabPanel
          value={SHARED_TAB.settings}
          id="settings-tabpanel"
          aria-labelledby="settings-tab"
        >
          <props.components.NotebookSettings />
        </TabPanel>
      </TabContext>
    </>
  );
};
