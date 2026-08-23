import {LIST_OF_RECORDS_PLAN_TYPE, ListPlan} from '@faims3/data-model';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import {
  Alert,
  Button,
  Card,
  CardActions,
  CardContent,
  Grid,
  Tab,
  Typography,
} from '@mui/material';
import {useCallback, useMemo} from 'react';
import {RecordsTable} from '../record_table';
import {resolveTab} from '../../../../constants/routes';
import {NotebookViewComponentProps} from '../types';
import {config} from '../../../../buildconfig';

// This view's tab slugs, default first
const TABS = ['planned', 'all-records', 'details', 'settings', 'map'] as const;

/**
 * A view component for the list of records plan type. Shows pre-populated cards
 * for the planned records with a status display if the record has been created.
 *
 */
export const ListOfRecordsPlanView = (props: NotebookViewComponentProps) => {
  const {project, tab, uiSpecification, records, actions, status} = props;

  const currentTab = resolveTab(TABS, tab);

  // recordLabel based on viewsets
  const recordLabel =
    uiSpecification.visible_types?.length === 1
      ? uiSpecification.viewsets[uiSpecification.visible_types[0]]?.label ||
        uiSpecification.visible_types[0]
      : 'Record';

  // A claimed entry is proof the record exists, but an unclaimed one is not
  // proof it does not: the list can hide records the user may not read, and
  // records still downloading have not arrived yet.
  const unclaimedMayBeStale =
    !status.canReadAllRecords || status.isDownloadingRecords;

  // work out which records we've already created from the plan
  // by checking the planReference field in the record metadata
  const existingRecords: Record<string, boolean> = useMemo(() => {
    const existing: Record<string, boolean> = {};
    records.allRecords.forEach(record => {
      if (record.planReference) {
        existing[record.planReference] = true;
      }
    });
    return existing;
  }, [records.allRecords]);

  const navigateToRecord = useCallback(
    (planReference: string) => {
      // find the record with the given planReference
      const record = records.allRecords.find(
        r => r.planReference === planReference
      );
      // and navigate to it if we found it
      if (record) {
        actions.navigateToRecord(record);
      }
    },
    [records.allRecords, actions.navigateToRecord]
  );

  // Should not need this but it guards the type cast below
  if (project.uiDefinition?.plan?.planType !== LIST_OF_RECORDS_PLAN_TYPE) {
    return (
      <div>
        ListOfRecordsPlanView: Not a list of records plan for this{' '}
        {config.notebookName}
      </div>
    );
  }
  // this really is a list of records plan
  const plan = project.uiDefinition.plan as ListPlan | undefined;
  if (!plan) {
    return <div>No plan defined for this {config.notebookName}</div>;
  }
  const plannedRecords = plan.records;
  if (!plannedRecords) {
    return <div>No planned records defined for this {config.notebookName}</div>;
  }

  return (
    <>
      <Alert severity="info">
        <b>List of Records Plan</b>: Collect {plan.formType} records.{' '}
        {!plan.allowExtraRecords
          ? 'Do not allow extra records'
          : 'Extra records allowed'}
      </Alert>

      <TabContext value={currentTab}>
        <TabList
          onChange={(event, newValue) => actions.setTab(newValue)}
          aria-label={`List of Records Plan tabs`}
        >
          <Tab
            label={`Planned ${recordLabel}s`}
            value="planned"
            id="planned-tab"
            aria-controls="planned-tabpanel"
          />
          <Tab
            value="all-records"
            label={`All ${recordLabel}s`}
            id="all-tab"
            aria-controls="all-tabpanel"
          />
          <Tab
            value="details"
            label="Details"
            id="details-tab"
            aria-controls="details-tabpanel"
          />
          <Tab
            value="settings"
            label="Settings"
            id="settings-tab"
            aria-controls="settings-tabpanel"
          />
          <Tab
            value="map"
            label="Overview Map"
            id="overview-map-tab"
            aria-controls="overview-map-tabpanel"
          />
        </TabList>

        <TabPanel
          value="planned"
          id="planned-tabpanel"
          aria-labelledby="planned-tab"
        >
          {unclaimedMayBeStale && (
            <Alert severity="warning" sx={{mb: 1.5}}>
              Some records are not visible to you yet, so an entry shown as not
              created may already have one.
            </Alert>
          )}
          <Grid
            container
            spacing={{xs: 2, md: 3}}
            columns={{xs: 4, sm: 8, md: 12}}
          >
            {Object.entries(plannedRecords).map(
              ([planReference, plannedRecord]) => {
                return (
                  <Grid key={planReference} size={4}>
                    <RecordCard
                      record={plannedRecord}
                      type={plan.formType}
                      title={recordLabel}
                      planReference={planReference}
                      created={existingRecords[planReference] ?? false}
                      createRecord={actions.createRecord}
                      canCreateRecord={status.isAllowedToAddRecords}
                      navigateToRecord={navigateToRecord}
                    />
                  </Grid>
                );
              }
            )}
          </Grid>
        </TabPanel>
        <TabPanel
          value="all-records"
          id="all-tabpanel"
          aria-labelledby="all-tab"
        >
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
          value="details"
          id="details-tabpanel"
          aria-labelledby="details-tab"
        >
          <props.components.MetadataDisplayComponent />
        </TabPanel>
        <TabPanel
          value="settings"
          id="settings-tabpanel"
          aria-labelledby="settings-tab"
        >
          <props.components.NotebookSettings />
        </TabPanel>
        <TabPanel
          value="map"
          id="overview-map-tabpanel"
          aria-labelledby="overview-map-tab"
        >
          <props.components.OverviewMap />
        </TabPanel>
      </TabContext>
    </>
  );
};

/**
 * RecordCard component displays a single planned record and allows for either creation
 * of the record or navigation to the existing record if it has already been created.
 *
 * @param record - The planned record data to display
 * @param type - The viewset type of the record
 * @param title - The title to display for the record card
 * @param createRecord - Function to create a new record
 * @param canCreateRecord - Whether the user may create records in this notebook
 * @param created - Boolean indicating if the record has already been created
 * @param planReference - The unique reference for the planned record
 * @param navigateToRecord - Function to navigate to the existing record
 * @returns JSX.Element representing the record card
 */
const RecordCard = ({
  record,
  type,
  title,
  createRecord,
  canCreateRecord,
  created,
  planReference,
  navigateToRecord,
}: {
  record: Record<string, unknown>;
  type: string;
  title: string;
  planReference: string;
  created: boolean;
  createRecord: (
    viewsetName: string,
    data: Record<string, any>,
    planReference?: string
  ) => void;
  canCreateRecord: boolean;
  navigateToRecord: (planReference: string) => void;
}) => {
  const handleCreateRecord = () => {
    createRecord(type, record, planReference);
  };

  return (
    <Card>
      <CardContent>
        <Typography gutterBottom sx={{color: 'text.secondary', fontSize: 14}}>
          {title}{' '}
        </Typography>
        <Typography variant="body2">
          {Object.entries(record).map(([key, value]) => (
            <div key={key}>
              <strong>{key}:</strong> {String(value)}
            </div>
          ))}
        </Typography>
      </CardContent>
      <CardActions
        sx={{
          backgroundColor: created ? 'success.light' : 'background.paper',
        }}
      >
        {created ? (
          <Button
            size="small"
            sx={{backgroundColor: 'background.paper'}}
            onClick={() => navigateToRecord(planReference)}
          >
            Edit Record
          </Button>
        ) : (
          canCreateRecord && (
            <Button size="small" onClick={handleCreateRecord}>
              Create Record
            </Button>
          )
        )}
      </CardActions>
    </Card>
  );
};
