import {MinimalRecordMetadata, ProjectStatus} from '@faims3/data-model';
import {Alert, AlertTitle, Box, Paper, Tab, Tabs} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, {useMemo} from 'react';
import {config} from '../../../buildconfig';
import {DE_ACTIVATE_VERB} from '../workspace/notebooks';
import AddRecordButtons from './add_record_by_type';
import PushOnlySyncBanner from './PushOnlySyncBanner';
import {RecordsTable} from './record_table';
import {NotebookViewComponentProps, resolveTab} from './types';

// This view's tab slugs, default first
const TABS = [
  'my-records',
  'other-records',
  'map',
  'details',
  'settings',
] as const;

export type ListOfFormsViewProps = NotebookViewComponentProps & {
  /** The forms to present, in the order to present them. */
  formTypes: string[];
  /** Claims for a plan every record the view creates. */
  planReference?: string;
};

interface TabPanelProps {
  children?: React.ReactNode;
  /** The tab slug this panel belongs to. */
  tab: string;
  /** The tab slug currently shown. */
  value: string;
}

/**
 * TabPanel renders its children only while its tab is the one shown.
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
 */
function a11yProps(tab: string) {
  return {
    id: `${tab}-tab`,
    'aria-controls': `${tab}-tabpanel`,
  };
}

/**
 * ListOfFormsView presents a set of forms for creating and browsing records:
 * an add button per form, the notebook's records of those forms split into
 * the user's own and the rest, a map, and the details and settings tabs. The
 * default notebook view renders it with the notebook's visible forms; a
 * ListOfForms plan renders it with the forms the plan names.
 *
 * @param props - The notebook view props plus the forms to present.
 * @returns The JSX element for the view.
 */
export function ListOfFormsView(props: ListOfFormsViewProps) {
  const {
    project,
    tab,
    uiSpecification,
    records,
    actions,
    status,
    components,
    formTypes,
    planReference,
  } = props;
  const theme = useTheme();
  const isMedium = useMediaQuery(theme.breakpoints.up('md'));

  const currentTab = resolveTab(TABS, tab.current);

  const viewsets = uiSpecification.viewsets;
  // One form names its records; several fall back to the generic label
  const recordLabel =
    formTypes.length === 1
      ? viewsets[formTypes[0]]?.label || formTypes[0]
      : 'Record';

  // Forms to offer an add button for, less any viewset that opts out of one
  const addableTypes = formTypes.filter(
    type => viewsets[type]?.is_visible !== false
  );

  // Every notebook record of the listed forms, whichever plan made it
  const {myRecords, otherRecords, notebookRecords} = useMemo(() => {
    const inForms = (r: MinimalRecordMetadata) => formTypes.includes(r.type);
    return {
      myRecords: records.myRecords.filter(inForms),
      otherRecords: records.otherRecords.filter(inForms),
      notebookRecords: records.notebookRecords.filter(inForms),
    };
  }, [
    records.myRecords,
    records.otherRecords,
    records.notebookRecords,
    formTypes,
  ]);

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
        onGoToSyncSettings={() => tab.select('settings')}
      />
      <Box>
        {status.isAllowedToAddRecords && addableTypes.length > 0 && (
          <Box sx={{mb: 1.5}}>
            <AddRecordButtons
              project={project}
              formTypes={addableTypes}
              planReference={planReference}
              refreshList={actions.refreshRecordList}
            />
          </Box>
        )}
        {/* The tab bar auto scrolls, so on small screens a gap appears on the
        left for the hidden scroll button when scrolled right */}
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
              onChange={(_event, newTab: string) => tab.select(newTab)}
              aria-label={`${config.notebookName} tabs`}
              indicatorColor="secondary"
              sx={{
                backgroundColor: theme.palette.background.tabsBackground,
                justifyItems: 'space-between',
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
                label="Map"
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

        <TabPanel value={currentTab} tab="my-records">
          <RecordsTable
            project={project}
            maxRows={25}
            rows={myRecords}
            loading={status.isLoading}
            viewsets={viewsets}
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
            viewsets={viewsets}
            formTypes={formTypes}
            handleQueryFunction={actions.setQuery}
            handleRefresh={actions.refreshRecordList}
            recordLabel={recordLabel}
            recordStatus={records.syncStatus}
          />
        </TabPanel>

        <TabPanel value={currentTab} tab="map">
          {/* The injected map plots the plan's records by default; this view
          lists by form, so plot the same set */}
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
}
