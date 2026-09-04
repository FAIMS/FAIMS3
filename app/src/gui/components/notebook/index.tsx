import {getVisibleTypes, ProjectStatus} from '@faims3/data-model';
import {Alert, AlertTitle, Box, Paper, Tab, Tabs} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import React from 'react';
import {config} from '../../../buildconfig';
import {SHARED_TAB, useResolveTab} from '../../../constants/routes';
import {DE_ACTIVATE_VERB} from '../workspace/notebooks';
import AddRecordButtons from './add_record_by_type';
import PushOnlySyncBanner from './PushOnlySyncBanner';
import {RecordsTable} from './record_table';
import {NotebookViewComponentProps} from './types';

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
 * NotebookComponent is the default notebook view, used when a notebook has no
 * plan or no view is registered for its plan type. It conforms to
 * NotebookViewComponentProps like any registered plan view.
 *
 * @param props - The notebook view props assembled by NotebookView.
 * @returns The JSX element for the NotebookComponent.
 */
export default function NotebookComponent(props: NotebookViewComponentProps) {
  const {project, tab, uiSpecification, records, actions, status, components} =
    props;
  const theme = useTheme();
  const isMedium = useMediaQuery(theme.breakpoints.up('md'));

  const currentTab = useResolveTab(TABS, tab, actions.setTab);

  const viewsets = uiSpecification.viewsets;

  // recordLabel based on viewsets
  const recordLabel =
    uiSpecification.visible_types?.length === 1
      ? uiSpecification.viewsets[uiSpecification.visible_types[0]]?.label ||
        uiSpecification.visible_types[0]
      : 'Record';

  // Tab counts show only visible types; the tables keep the unfiltered lists
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
        onGoToSyncSettings={() => actions.setTab(SHARED_TAB.settings)}
      />
      <Box>
        {status.isAllowedToAddRecords && (
          <Box sx={{mb: 1.5}}>
            <AddRecordButtons
              project={project}
              recordLabel={recordLabel}
              refreshList={actions.refreshRecordList}
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
              onChange={(_event, newTab: string) => actions.setTab(newTab)}
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

        <TabPanel value={currentTab} tab="my-records">
          <RecordsTable
            project={project}
            maxRows={25}
            rows={records.myRecords}
            loading={status.isLoading}
            viewsets={viewsets}
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
            rows={records.otherRecords}
            loading={status.isLoading}
            viewsets={viewsets}
            handleQueryFunction={actions.setQuery}
            handleRefresh={actions.refreshRecordList}
            recordLabel={recordLabel}
            recordStatus={records.syncStatus}
          />
        </TabPanel>

        <TabPanel value={currentTab} tab={SHARED_TAB.map}>
          <components.OverviewMap />
        </TabPanel>

        <TabPanel value={currentTab} tab={SHARED_TAB.details}>
          <components.MetadataDisplayComponent />
        </TabPanel>

        <TabPanel value={currentTab} tab={SHARED_TAB.settings}>
          <components.NotebookSettings />
        </TabPanel>
      </Box>
    </Box>
  );
}
