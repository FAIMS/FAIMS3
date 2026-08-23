import {Action, getVisibleTypes, ProjectStatus} from '@faims3/data-model';
import {Alert, AlertTitle, Box, Paper, Tab, Tabs} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useQueryClient} from '@tanstack/react-query';
import React, {useState} from 'react';
import {config} from '../../../buildconfig';
import {selectActiveUser} from '../../../context/slices/authSlice';
import {compiledSpecService} from '../../../context/slices/helpers/compiledSpecService';
import {Project, selectProjectById} from '../../../context/slices/projectSlice';
import {useAppSelector} from '../../../context/store';
import {useRecordAudit} from '../../../utils/apiHooks/notebooks';
import {SHARED_TAB, useResolveTab} from '../../../constants/routes';
import {
  invalidateProjectHydration,
  invalidateProjectRecordList,
  useIsAuthorisedTo,
  useRecordList,
} from '../../../utils/customHooks';
import CircularLoading from '../ui/circular_loading';
import {DE_ACTIVATE_VERB} from '../workspace/notebooks';
import AddRecordButtons from './add_record_by_type';
import {MetadataDisplayComponent} from './MetadataDisplay';
import {OverviewMap} from './OverviewMap';
import PushOnlySyncBanner from './PushOnlySyncBanner';
import {RecordsTable} from './record_table';
import NotebookSettings from './settings';

// This view's tab slugs, default first
const TABS = [
  'my-records',
  'other-records',
  SHARED_TAB.map,
  SHARED_TAB.details,
  SHARED_TAB.settings,
] as const;

/**
 * TabPanelProps defines the properties for the TabPanel component.
 */
interface TabPanelProps {
  children?: React.ReactNode;
  /** The tab slug this panel belongs to. */
  tab: string;
  /** The tab slug currently shown. */
  value: string;
}

/**
 * TabPanel is a component for displaying the content of a specific tab.
 * It conditionally renders its children based on the active tab.
 *
 * @param {TabPanelProps} props - The properties for the TabPanel.
 * @returns {JSX.Element} - The JSX element for the TabPanel.
 */
function TabPanel(props: TabPanelProps) {
  const {children, value, tab, ...other} = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== tab}
      id={`${tab}-tabpanel`}
      aria-labelledby={`${tab}-tab`}
      {...other}
    >
      {value === tab && <Box>{children}</Box>}
    </div>
  );
}

/**
 * a11yProps returns accessibility props for a tab, pairing it with its panel.
 *
 * @param {string} tab - The slug of the tab.
 * @returns {object} - The accessibility properties for the tab.
 */
function a11yProps(tab: string) {
  return {
    id: `${tab}-tab`,
    'aria-controls': `${tab}-tabpanel`,
  };
}

/**
 * NotebookComponentProps defines the properties for the NotebookComponent component.
 */
type NotebookComponentProps = {
  project: Project;
  tab?: string;
  setTab: (tab: string) => void;
};

/**
 * NotebookComponent is a component that displays the main interface for the notebook.
 * It includes tabs for Records, Details, Access, Layers, and Settings.
 *
 * @param props - The properties for the NotebookComponent.
 * @returns The JSX element for the NotebookComponent.
 */
export default function NotebookComponent({
  project,
  tab,
  setTab,
}: NotebookComponentProps) {
  const theme = useTheme();
  const isMedium = useMediaQuery(theme.breakpoints.up('md'));
  const queryClient = useQueryClient();

  const isAllowedToAddRecords =
    useIsAuthorisedTo({
      action: Action.CREATE_PROJECT_RECORD,
      resourceId: project.projectId,
    }) && project.status === ProjectStatus.OPEN;

  const {uiSpecificationId} = project;
  const uiSpecification = compiledSpecService.getSpec(uiSpecificationId);

  const activeUser = useAppSelector(selectActiveUser);

  // get the sync status of records in this project
  const recordStatus = useRecordAudit({
    projectId: project.projectId,
    listingId: project.serverId,
    username: activeUser?.username ?? '',
  });

  const currentTab = useResolveTab(TABS, tab, setTab);

  // Fetch records from the (local) DB with configurable auto refetch.
  // Skip while the compiled UI spec is still loading.
  const [query, setQuery] = useState<string>('');
  const records = useRecordList({
    query: query,
    // Profiling enabled when debugging
    enableProfiling: config.debugApp,
    projectId: project.projectId,
    filterDeleted: true,
    // refetch every 10 seconds (local only fetch - no network traffic here)
    metadataRefreshIntervalMs: 10000,
    uiSpecification,
    enabled: !!uiSpecification,
  });
  const forceRecordRefresh = records.initialQuery.refetch;

  const templateId = useAppSelector(
    state => selectProjectById(state, project.projectId)?.templateId
  );

  if (!uiSpecification) {
    return <CircularLoading label="Loading" />;
  }

  const viewsets = uiSpecification.viewsets;

  const goToSyncSettings = () => {
    setTab(SHARED_TAB.settings);
  };

  // recordLabel based on viewsets
  const recordLabel =
    uiSpecification.visible_types?.length === 1
      ? uiSpecification.viewsets[uiSpecification.visible_types[0]]?.label ||
        uiSpecification.visible_types[0]
      : 'Record';

  const visibleTypes = getVisibleTypes(uiSpecification);
  const visibleMyRecords = records.myRecords.filter(r =>
    visibleTypes.includes(r.type)
  );
  const visibleOtherRecords = records.otherRecords.filter(r =>
    visibleTypes.includes(r.type)
  );

  return (
    <Box>
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
        onGoToSyncSettings={goToSyncSettings}
      />
      <Box>
        {isAllowedToAddRecords && (
          <Box sx={{mb: 1.5}}>
            <AddRecordButtons
              project={project}
              recordLabel={recordLabel}
              refreshList={() => {
                invalidateProjectRecordList({
                  client: queryClient,
                  projectId: project.projectId,
                  reset: true,
                });
                invalidateProjectHydration({
                  client: queryClient,
                  projectId: project.projectId,
                  reset: true,
                });
              }}
            />
          </Box>
        )}
        {/* Note that the Tab bar below is set to auto scroll, so on sm screens
        there is a gap on the left due to the hidden left scroll button, this appears
        if you scroll right.  There doesn't seem to be a way to push the content all
        the way to the left when the scroll button is hidden.
        
        Previous margin adjustments have been removed */}
        <Box
          sx={{
            mb: 2,
          }}
          component={Paper}
          elevation={0}
          variant={isMedium ? 'outlined' : 'elevation'}
        >
          <Paper
            sx={{
              backgroundColor: theme.palette.background.tabsBackground,
            }}
          >
            <Tabs
              value={currentTab}
              onChange={(_event, newTab: string) => setTab(newTab)}
              aria-label={`${config.notebookName} tabs`}
              indicatorColor="secondary"
              sx={{
                backgroundColor: theme.palette.background.tabsBackground,
                justifyItems: 'space-between',
                '& .MuiTabs-indicator': {
                  backgroundColor: theme.palette.secondary.contrastText,
                },

                // Make more compact if needed

                '& .MuiTab-root': !isMedium
                  ? {
                      // Target all tabs
                      padding: '3px 6px', // Reduce default padding (normally 12px 16px)
                      minWidth: 'auto', // Override default min-width
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
                label={`My ${recordLabel}s (${visibleMyRecords.length})`}
                value="my-records"
                data-testid="app-notebook-tab-my-records"
                {...a11yProps('my-records')}
              />
              {(currentTab === 'other-records' ||
                visibleOtherRecords.length > 0) && (
                <Tab
                  value="other-records"
                  label={`Other ${recordLabel}s (${visibleOtherRecords.length})`}
                  data-testid="app-notebook-tab-other-records"
                  {...a11yProps('other-records')}
                />
              )}

              <Tab
                value={SHARED_TAB.map}
                label="Map"
                data-testid="app-notebook-tab-map"
                {...a11yProps(SHARED_TAB.map)}
              />
              <Tab
                value={SHARED_TAB.details}
                label="Details"
                data-testid="app-notebook-tab-details"
                {...a11yProps(SHARED_TAB.details)}
              />
              <Tab
                value={SHARED_TAB.settings}
                label="Settings"
                data-testid="app-notebook-tab-settings"
                {...a11yProps(SHARED_TAB.settings)}
              />
            </Tabs>
          </Paper>
        </Box>

        {
          // My records
        }
        <TabPanel value={currentTab} tab="my-records">
          <RecordsTable
            project={project}
            maxRows={25}
            rows={records.myRecords}
            loading={records.isLoading}
            viewsets={viewsets}
            handleQueryFunction={setQuery}
            handleRefresh={forceRecordRefresh}
            recordLabel={recordLabel}
            recordStatus={recordStatus.data}
          />
        </TabPanel>
        {
          // Other records
        }

        <TabPanel value={currentTab} tab="other-records">
          <RecordsTable
            project={project}
            maxRows={25}
            rows={records.otherRecords}
            loading={records.isLoading}
            viewsets={viewsets}
            handleQueryFunction={setQuery}
            handleRefresh={forceRecordRefresh}
            recordLabel={recordLabel}
            recordStatus={recordStatus.data}
          />
        </TabPanel>

        <TabPanel value={currentTab} tab={SHARED_TAB.map}>
          <OverviewMap
            records={records}
            serverId={project.serverId}
            project_id={project.projectId}
            uiSpec={uiSpecification}
          />
        </TabPanel>

        <TabPanel value={currentTab} tab={SHARED_TAB.details}>
          <MetadataDisplayComponent project={project} templateId={templateId} />
        </TabPanel>

        <TabPanel value={currentTab} tab={SHARED_TAB.settings}>
          <NotebookSettings uiSpec={uiSpecification} />
        </TabPanel>
      </Box>
    </Box>
  );
}
