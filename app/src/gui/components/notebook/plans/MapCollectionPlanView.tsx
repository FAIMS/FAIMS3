/**
 * @file The view for a Map Collection plan: the plan's entries on a map and as
 * a list, each created or pending, beside the survey tabs a form's records are
 * browsed through (my and other records, the overview map of saved geometry,
 * details and settings).
 */
import {
  MAP_COLLECTION_PLAN_TYPE,
  mapCollectionGeometrySummary,
  mapCollectionInitialRecordData,
  planReferenceFor,
  ProjectStatus,
  type MapCollectionPlanEntry,
  type MinimalRecordMetadata,
} from '@faims3/data-model';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Grid,
  Paper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useCallback, useMemo} from 'react';
import {config} from '../../../../buildconfig';
import {DE_ACTIVATE_VERB} from '../../workspace/notebooks';
import AddRecordButtons from '../add_record_by_type';
import {a11yProps, TabPanel} from '../notebookTabs';
import PushOnlySyncBanner from '../PushOnlySyncBanner';
import {RecordsTable} from '../record_table';
import {NotebookViewComponentProps, resolveTab} from '../types';
import {PlanRecordMap} from './PlanRecordMap';
import {
  createdPlanReferences,
  planRecordFeatures,
} from './planRecordMapFeatures';
import {planRecordLabel} from './planViewRecords';

// This view's tab slugs, default first
const TABS = [
  'record-map',
  'planned-records',
  'my-records',
  'other-records',
  'map',
  'details',
  'settings',
] as const;

/**
 * A view component for the map collection plan type.
 */
export const MapCollectionPlanView = (props: NotebookViewComponentProps) => {
  const {project, tab, uiSpecification, records, actions, status, components} =
    props;
  const theme = useTheme();
  const isMedium = useMediaQuery(theme.breakpoints.up('md'));

  const currentTab = resolveTab(TABS, tab.current);

  // The notebook may carry several plans, so the one to render arrives in
  // props rather than being read back off the project.
  const plan =
    props.plan?.planType === MAP_COLLECTION_PLAN_TYPE ? props.plan : undefined;

  // A claimed entry is proof the record exists, but an unclaimed one is not
  // proof it does not: the list can hide records the user may not read, and
  // records still downloading have not arrived yet.
  const unclaimedMayBeStale =
    !status.canReadAllRecords || status.isDownloadingRecords;

  const created = useMemo(
    () => createdPlanReferences(records.planRecords),
    [records.planRecords]
  );

  const features = useMemo(
    () =>
      plan
        ? planRecordFeatures({plan, created})
        : {type: 'FeatureCollection' as const, features: []},
    [plan, created]
  );

  // Before the type guard so hook order holds; stable for the table's memos
  const formTypes = useMemo(() => (plan ? [plan.formType] : []), [plan]);

  // Every notebook record of the plan's form, whichever plan made it
  const {myRecords, otherRecords, notebookRecords} = useMemo(() => {
    const inForm = (r: MinimalRecordMetadata) => formTypes.includes(r.type);
    return {
      myRecords: records.myRecords.filter(inForm),
      otherRecords: records.otherRecords.filter(inForm),
      notebookRecords: records.notebookRecords.filter(inForm),
    };
  }, [
    records.myRecords,
    records.otherRecords,
    records.notebookRecords,
    formTypes,
  ]);

  const spatialComponentName = plan
    ? uiSpecification.fields[plan.spatialFieldId]?.['component-name']
    : undefined;

  const createFromEntry = useCallback(
    (reference: string) => {
      if (!plan) return;
      const entry = plan.records[reference];
      if (!entry) return;
      actions.createRecord(
        plan.formType,
        mapCollectionInitialRecordData({plan, entry, spatialComponentName}),
        planReferenceFor({planId: plan.planId, reference})
      );
    },
    [plan, spatialComponentName, actions.createRecord]
  );

  const navigateToRecord = useCallback(
    (planReference: string) => {
      const record = records.planRecords.find(
        r => r.planReference === planReference
      );
      if (record) actions.navigateToRecord(record);
    },
    [records.planRecords, actions.navigateToRecord]
  );

  if (!plan) {
    return (
      <div>
        MapCollectionPlanView: Not a map collection plan for this{' '}
        {config.notebookName}
      </div>
    );
  }

  const recordLabel = planRecordLabel({uiSpecification, plan});
  const entries = Object.entries(plan.records);
  const createdCount = entries.filter(([reference]) =>
    created.has(planReferenceFor({planId: plan.planId, reference}))
  ).length;

  return (
    <Box>
      {/* The plan's label leads, since the plan type names nothing a user has
      seen and two plans may sit on the one form */}
      <Alert severity="info" sx={{mb: 1}}>
        <b>{plan.label}</b>: collect {recordLabel} records at {entries.length}{' '}
        planned location{entries.length === 1 ? '' : 's'} ({createdCount}{' '}
        created).{' '}
        {plan.allowExtraRecords
          ? 'Extra records allowed'
          : 'Do not allow extra records'}
        {/* A notebook with one plan never shows the chooser, so this is the
        only place its description is read */}
        {plan.description && <div>{plan.description}</div>}
      </Alert>
      {project.status === ProjectStatus.CLOSED && (
        <Alert variant="standard" severity="warning" sx={{mb: 1}}>
          <AlertTitle>{config.notebookNameCapitalized} is closed</AlertTitle>
          Ensure your records have a green sync status and then{' '}
          {DE_ACTIVATE_VERB.toLowerCase()} this {config.notebookName} via the
          settings tab. No additional data can be collected for this{' '}
          {config.notebookName}.
        </Alert>
      )}
      <PushOnlySyncBanner
        project={project}
        onGoToSyncSettings={() => tab.select('settings')}
      />
      <Box>
        {status.isAllowedToAddRecords && plan.allowExtraRecords && (
          <Box sx={{mb: 1.5}}>
            <AddRecordButtons
              project={project}
              formTypes={formTypes}
              planReference={planReferenceFor({planId: plan.planId})}
              refreshList={actions.refreshRecordList}
            />
          </Box>
        )}
        <Box
          sx={{mb: 2}}
          component={Paper}
          elevation={0}
          variant={isMedium ? 'outlined' : 'elevation'}
        >
          <Paper
            sx={{backgroundColor: theme.palette.background.tabsBackground}}
          >
            <Tabs
              value={currentTab}
              onChange={(_event, newTab: string) => tab.select(newTab)}
              aria-label={`${plan.label} tabs`}
              indicatorColor="secondary"
              sx={{
                backgroundColor: theme.palette.background.tabsBackground,
                '& .MuiTabs-indicator': {
                  backgroundColor: theme.palette.secondary.contrastText,
                },
                // Compact the tabs on small screens
                '& .MuiTab-root': !isMedium
                  ? {
                      padding: '3px 6px',
                      minWidth: 'auto',
                      fontSize: '0.8rem',
                      marginRight: '2px',
                      marginLeft: '2px',
                    }
                  : {},
              }}
              textColor="inherit"
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile={true}
            >
              <Tab
                label="Record Map"
                value="record-map"
                data-testid="app-notebook-tab-record-map"
                {...a11yProps('record-map')}
              />
              <Tab
                label={`Planned ${recordLabel}s (${entries.length})`}
                value="planned-records"
                data-testid="app-notebook-tab-planned-records"
                {...a11yProps('planned-records')}
              />
              <Tab
                label={`My ${recordLabel}s (${myRecords.length})`}
                value="my-records"
                data-testid="app-notebook-tab-my-records"
                {...a11yProps('my-records')}
              />
              {(currentTab === 'other-records' || otherRecords.length > 0) && (
                <Tab
                  value="other-records"
                  label={`Other ${recordLabel}s (${otherRecords.length})`}
                  data-testid="app-notebook-tab-other-records"
                  {...a11yProps('other-records')}
                />
              )}
              <Tab
                value="map"
                label="Overview Map"
                data-testid="app-notebook-tab-map"
                {...a11yProps('map')}
              />
              <Tab
                value="details"
                label="Details"
                data-testid="app-notebook-tab-details"
                {...a11yProps('details')}
              />
              <Tab
                value="settings"
                label="Settings"
                data-testid="app-notebook-tab-settings"
                {...a11yProps('settings')}
              />
            </Tabs>
          </Paper>
        </Box>

        <TabPanel value={currentTab} tab="record-map">
          {unclaimedMayBeStale && <StaleWarning />}
          <PlanRecordMap
            features={features}
            entries={plan.records}
            recordLabel={recordLabel}
            canCreateRecord={status.isAllowedToAddRecords}
            onCreate={createFromEntry}
            onOpen={navigateToRecord}
          />
        </TabPanel>

        <TabPanel value={currentTab} tab="planned-records">
          {unclaimedMayBeStale && <StaleWarning />}
          <Grid
            container
            spacing={{xs: 2, md: 3}}
            columns={{xs: 4, sm: 8, md: 12}}
          >
            {entries.map(([reference, entry]) => {
              const planReference = planReferenceFor({
                planId: plan.planId,
                reference,
              });
              return (
                <Grid key={reference} size={4}>
                  <PlannedEntryCard
                    reference={reference}
                    entry={entry}
                    title={recordLabel}
                    created={created.has(planReference)}
                    canCreateRecord={status.isAllowedToAddRecords}
                    onCreate={() => createFromEntry(reference)}
                    onOpen={() => navigateToRecord(planReference)}
                  />
                </Grid>
              );
            })}
          </Grid>
        </TabPanel>

        <TabPanel value={currentTab} tab="my-records">
          <RecordsTable
            project={project}
            maxRows={25}
            rows={myRecords}
            loading={status.isLoading}
            viewsets={uiSpecification.viewsets}
            formTypes={formTypes}
            handleQueryFunction={actions.setQuery}
            handleRefresh={actions.refreshRecordList}
            recordLabel={recordLabel}
            recordStatus={records.syncStatus}
          />
        </TabPanel>

        <TabPanel value={currentTab} tab="other-records">
          <RecordsTable
            project={project}
            maxRows={25}
            rows={otherRecords}
            loading={status.isLoading}
            viewsets={uiSpecification.viewsets}
            formTypes={formTypes}
            handleQueryFunction={actions.setQuery}
            handleRefresh={actions.refreshRecordList}
            recordLabel={recordLabel}
            recordStatus={records.syncStatus}
          />
        </TabPanel>

        <TabPanel value={currentTab} tab="map">
          {/* Saved record geometry, for every record of the form, whichever
          plan made it: the same set the My/Other tabs list */}
          <components.OverviewMap records={notebookRecords} />
        </TabPanel>

        <TabPanel value={currentTab} tab="details">
          <components.MetadataDisplayComponent />
        </TabPanel>

        <TabPanel value={currentTab} tab="settings">
          <components.NotebookSettings />
        </TabPanel>
      </Box>
    </Box>
  );
};

const StaleWarning = () => (
  <Alert severity="warning" sx={{mb: 1.5}}>
    Some records are not visible to you yet, so an entry shown as not created
    may already have one.
  </Alert>
);

/**
 * One planned entry: its pre-filled values and geometry, and either the way
 * to its record or the way to create it.
 */
const PlannedEntryCard = ({
  reference,
  entry,
  title,
  created,
  canCreateRecord,
  onCreate,
  onOpen,
}: {
  reference: string;
  entry: MapCollectionPlanEntry;
  title: string;
  created: boolean;
  canCreateRecord: boolean;
  onCreate: () => void;
  onOpen: () => void;
}) => (
  <Card data-testid={`planned-entry-${reference}`}>
    <CardContent>
      <Typography gutterBottom sx={{color: 'text.secondary', fontSize: 14}}>
        {title} · {reference}
      </Typography>
      <Typography variant="body2" component="div">
        {Object.entries(entry.fields).map(([key, value]) => (
          <div key={key}>
            <strong>{key}:</strong> {String(value)}
          </div>
        ))}
        <div>
          <strong>Geometry:</strong> {mapCollectionGeometrySummary(entry)}
        </div>
      </Typography>
    </CardContent>
    <CardActions
      sx={{
        backgroundColor: created ? 'success.light' : 'warning.light',
      }}
    >
      {created ? (
        <Button
          size="small"
          sx={{backgroundColor: 'background.paper'}}
          onClick={onOpen}
        >
          View Record
        </Button>
      ) : (
        canCreateRecord && (
          <Button
            size="small"
            sx={{backgroundColor: 'background.paper'}}
            onClick={onCreate}
          >
            Create Record
          </Button>
        )
      )}
    </CardActions>
  </Card>
);
