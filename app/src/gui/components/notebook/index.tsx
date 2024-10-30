import React, {useEffect, useState} from 'react';
import {
  Tabs,
  Tab,
  Typography,
  Box,
  Paper,
  AppBar,
  Alert,
  AlertTitle,
  Button,
  Grid,
  TableContainer,
  Table,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';
import {useNavigate} from 'react-router-dom';
import {ProjectUIViewsets} from '@faims3/data-model';
import {getUiSpecForProject} from '../../../uiSpecification';
import {ProjectUIModel} from '@faims3/data-model';
import DraftsTable from './draft_table';
import {RecordsBrowseTable} from './record_table';
import MetadataRenderer from '../metadataRenderer';
import AddRecordButtons from './add_record_by_type';
import NotebookSettings from './settings';
import {useTheme} from '@mui/material/styles';
import DraftTabBadge from './draft_tab_badge';
import useMediaQuery from '@mui/material/useMediaQuery';
import CircularLoading from '../ui/circular_loading';
import * as ROUTES from '../../../constants/routes';
import DashboardIcon from '@mui/icons-material/Dashboard';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '../../../buildconfig';
import {useQuery} from '@tanstack/react-query';
import {getMetadataValue} from '../../../sync/metadata';
import {ProjectExtended} from '../../../types/project';
import RangeHeader from './range_header';

/**
 * TabPanelProps defines the properties for the TabPanel component.
 */
interface TabPanelProps {
  children?: React.ReactNode;
  id: string;
  index: number;
  value: number;
}

/**
 * TabPanel is a component for displaying the content of a specific tab.
 * It conditionally renders its children based on the active tab.
 *
 * @param {TabPanelProps} props - The properties for the TabPanel.
 * @returns {JSX.Element} - The JSX element for the TabPanel.
 */
function TabPanel(props: TabPanelProps) {
  const {children, id, value, index, ...other} = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`${id}-${index}`}
      aria-labelledby={`${id}-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

/**
 * a11yProps returns accessibility properties for a tab.
 *
 * @param {number} index - The index of the tab.
 * @param {string} id - The id of the tab panel.
 * @returns {object} - The accessibility properties for the tab.
 */
function a11yProps(index: number, id: string) {
  /**
   * Accessibility props
   */
  return {
    id: `${id}-tab-${index}`,
    'aria-controls': `${id}-tabpanel-${index}`,
  };
}

/**
 * NotebookComponentProps defines the properties for the NotebookComponent component.
 */
type NotebookComponentProps = {
  project: ProjectExtended;
};

/**
 * NotebookComponent is a component that displays the main interface for the notebook.
 * It includes tabs for Records, Details, Access, Layers, and Settings.
 *
 * @param {NotebookComponentProps} props - The properties for the NotebookComponent.
 * @returns {JSX.Element} - The JSX element for the NotebookComponent.
 */
export default function NotebookComponent({project}: NotebookComponentProps) {
  const [notebookTabValue, setNotebookTabValue] = React.useState(0);
  const [recordDraftTabValue, setRecordDraftTabValue] = React.useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [myRecords, setMyRecords] = useState(0);
  /**
   * Handles the change event when the user switches between the Records and Drafts tabs.
   *
   * @param {React.SyntheticEvent} event - The event triggered by the tab change.
   * @param {number} newValue - The index of the selected tab.
   */
  const handleRecordDraftTabChange = (
    event: React.SyntheticEvent,
    newValue: number
  ) => {
    setRecordDraftTabValue(newValue);
  };

  /**
   * Handles the change event when the user switches between the main tabs.
   *
   * @param {React.SyntheticEvent} event - The event triggered by the tab change.
   * @param {number} newValue - The index of the selected tab.
   */
  const handleNotebookTabChange = (
    event: React.SyntheticEvent,
    newValue: number
  ) => {
    setNotebookTabValue(newValue);
  };

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [viewsets, setViewsets] = useState<null | ProjectUIViewsets>(null);
  const [uiSpec, setUiSpec] = useState<null | ProjectUIModel>(null);
  const theme = useTheme();
  const mq_above_md = useMediaQuery(theme.breakpoints.up('md'));
  const history = useNavigate();

  // recordLabel based on viewsets
  const recordLabel =
    uiSpec?.visible_types?.length === 1
      ? uiSpec.viewsets[uiSpec.visible_types[0]]?.label ||
        uiSpec.visible_types[0]
      : 'Record';

  const {data: template_id} = useQuery({
    queryKey: ['project-template-id', project.project_id],
    queryFn: () =>
      getMetadataValue(project.project_id, 'template_id') as Promise<string>,
  });

  /**
   * Fetches the UI specification and viewsets for the project
   */
  const pageLoader = () => {
    // Starting state reset
    setViewsets(null);
    setUiSpec(null);
    setErr('');
    setLoading(true);

    if (project.listing && project._id) {
      getUiSpecForProject(project.project_id)
        .then(spec => {
          setUiSpec(spec);
          setViewsets(spec.viewsets);
          setLoading(false);
          setErr('');
        })

        .catch(err => {
          setLoading(false);
          setErr(err.message);
        });
    }
  };

  /**
   * Fetches the UI specification and viewsets for the project when the
   * component mounts or the project changes.
   */
  useEffect(() => {
    pageLoader();
  }, [project]);

  // trigger a refresh of the content because something changed down below (a
  // record or draft was deleted)
  const handleRefresh = () => {
    pageLoader();
  };

  // Callback to handle counts from RecordsTable
  const handleCountChange = (counts: {total: number; myRecords: number}) => {
    setTotalRecords(counts.total);
    setMyRecords(counts.myRecords);
  };

  return (
    <Box>
      {err ? (
        <Alert severity="error">
          <AlertTitle>
            {' '}
            {project.name} {NOTEBOOK_NAME} cannot sync right now.
          </AlertTitle>
          Your device may be offline.
          <br />
          <Typography variant={'caption'}>{err}</Typography>
          <br />
          <br />
          Go to
          <Button
            variant="text"
            size={'small'}
            onClick={() => history(ROUTES.INDEX)}
            startIcon={<DashboardIcon />}
          >
            Workspace
          </Button>
        </Alert>
      ) : loading ? (
        <CircularLoading label={`${NOTEBOOK_NAME_CAPITALIZED} is loading`} />
      ) : (
        <Box>
          <Box
            mb={2}
            sx={{
              marginLeft: {sm: '-16px', md: 0},
              marginRight: {sm: '-16px', md: 0},
            }}
            component={Paper}
            elevation={0}
            variant={mq_above_md ? 'outlined' : 'elevation'}
          >
            <AppBar
              position="static"
              color="primary"
              sx={{paddingLeft: '16px'}}
            >
              <Tabs
                value={notebookTabValue}
                onChange={handleNotebookTabChange}
                aria-label={`${NOTEBOOK_NAME} tabs`}
                indicatorColor="secondary"
                TabIndicatorProps={{
                  style: {
                    backgroundColor: theme.palette.secondary.contrastText,
                  },
                }}
                sx={{backgroundColor: theme.palette.background.tabsBackground}}
                textColor="inherit"
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab
                  label={`${recordLabel}s`}
                  {...a11yProps(0, NOTEBOOK_NAME)}
                />
                <Tab label="Details" {...a11yProps(1, NOTEBOOK_NAME)} />
                <Tab label="Settings" {...a11yProps(2, NOTEBOOK_NAME)} />
              </Tabs>
            </AppBar>
          </Box>

          {/* Records count summary */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#EDEEEB',
              padding: '12px 16px',
              borderRadius: '4px',
              marginBottom: '16px',
            }}
          >
            <Typography variant="body2" sx={{fontSize: '1.1rem'}}>
              <strong>My {recordLabel}s:</strong> {myRecords}
            </Typography>

            <Typography variant="body2" sx={{fontSize: '1.1rem'}}>
              <strong>Total:</strong> {totalRecords}
            </Typography>
          </Box>

          <TabPanel value={notebookTabValue} index={0} id={'notebook'}>
            <Box>
              <AddRecordButtons project={project} recordLabel={recordLabel} />
            </Box>
            {/* Records/Drafts */}
            <Box mt={2}>
              <Box mb={1}>
                <Tabs
                  value={recordDraftTabValue}
                  onChange={handleRecordDraftTabChange}
                  aria-label={`${NOTEBOOK_NAME}-records`}
                  sx={{
                    backgroundColor: theme.palette.background.tabsBackground,
                  }}
                >
                  <Tab
                    label={`My ${recordLabel}s`}
                    {...a11yProps(0, `${NOTEBOOK_NAME}-records`)}
                  />
                  <Tab
                    label={<DraftTabBadge project_id={project.project_id} />}
                    {...a11yProps(1, `${NOTEBOOK_NAME}-records`)}
                  />
                </Tabs>
              </Box>
              <TabPanel
                value={recordDraftTabValue}
                index={0}
                id={'records-drafts-'}
              >
                <RecordsBrowseTable
                  project_id={project.project_id}
                  maxRows={25}
                  viewsets={viewsets}
                  filter_deleted={true}
                  handleRefresh={handleRefresh}
                  onRecordsCountChange={handleCountChange}
                />
              </TabPanel>
              <TabPanel
                value={recordDraftTabValue}
                index={1}
                id={'records-drafts-'}
              >
                <DraftsTable
                  project_id={project.project_id}
                  maxRows={25}
                  viewsets={viewsets}
                  handleRefresh={handleRefresh}
                />
              </TabPanel>
            </Box>
          </TabPanel>

          <TabPanel value={notebookTabValue} index={1} id={'notebook'}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
                px: 2,
              }}
            >
              {/* <Box
                component="h2"
                sx={{
                  textAlign: 'left',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  marginBottom: '16px',
                }}
              >
                Survey Details
              </Box> */}
              <Typography
                variant="body1"
                sx={{
                  textAlign: 'center',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  flexGrow: 1,
                }}
              >
                Survey Details
              </Typography>

              {/* Unhide the edit button when the notebook cna be edited */}
              {/* <IconButton
                color="primary"
                aria-label="edit"
                onClick={() => {
                  console.log('Edit Survey Details clicked');
                }}
                sx={{display: 'flex', alignItems: 'center'}}
              >
                <EditIcon />
                <Typography
                  variant="body2"
                  color="primary"
                  sx={{marginLeft: '4px'}}
                >
                  Edit
                </Typography>
              </IconButton> */}
            </Box>

            <Box sx={{p: 2}}>
              <Typography
                variant="body1"
                gutterBottom
                sx={{marginBottom: '16px'}}
              >
                <strong>Name:</strong>{' '}
                <MetadataRenderer
                  project_id={project.project_id}
                  metadata_key={'name'}
                  chips={false}
                />
              </Typography>
              {template_id && (
                <Typography
                  variant="body1"
                  gutterBottom
                  sx={{marginBottom: '16px'}}
                >
                  <strong>Template Used: </strong>
                  <span>{template_id}</span>
                </Typography>
              )}
              <Typography
                variant="body1"
                gutterBottom
                component="div"
                sx={{marginBottom: '16px'}}
              >
                <strong>Description:</strong>{' '}
                <MetadataRenderer
                  project_id={project.project_id}
                  metadata_key={'pre_description'}
                  chips={false}
                />
              </Typography>

              <Typography
                variant="body1"
                gutterBottom
                sx={{marginBottom: '16px'}}
              >
                <strong>Lead Institution:</strong>{' '}
                <MetadataRenderer
                  project_id={project.project_id}
                  metadata_key={'lead_institution'}
                  chips={false}
                />
              </Typography>
              <Typography
                variant="body1"
                gutterBottom
                sx={{marginBottom: '16px', textAlign: 'left'}}
              >
                <strong>Project Lead:</strong>{' '}
                <MetadataRenderer
                  project_id={project.project_id}
                  metadata_key={'project_lead'}
                  chips={false}
                />
              </Typography>
            </Box>
            <Grid container spacing={{xs: 1, sm: 2, md: 3}}>
              <Grid item xs={12} sm={6} md={6} lg={4}>
                <Box component={Paper} elevation={0} variant={'outlined'} p={2}>
                  <Typography variant={'h6'} sx={{mb: 2}}>
                    Description
                  </Typography>
                  <Typography variant="body2" color="textPrimary" gutterBottom>
                    <MetadataRenderer
                      project_id={project.project_id}
                      metadata_key={'pre_description'}
                      chips={false}
                    />
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TableContainer
                  component={Paper}
                  elevation={0}
                  variant={'outlined'}
                >
                  <Typography variant={'h6'} sx={{m: 2}} gutterBottom>
                    About
                  </Typography>
                  <Table size={'small'}>
                    <TableBody>
                      <TableRow>
                        <TableCell>
                          <Typography variant={'overline'}>Status</Typography>
                        </TableCell>
                        <TableCell>
                          <MetadataRenderer
                            project_id={project.project_id}
                            metadata_key={'project_status'}
                            chips={false}
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <Typography variant={'overline'}>
                            Lead Institution
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <MetadataRenderer
                            project_id={project.project_id}
                            metadata_key={'lead_institution'}
                            chips={false}
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <Typography variant={'overline'}>
                            Project Lead
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <MetadataRenderer
                            project_id={project.project_id}
                            metadata_key={'project_lead'}
                            chips={false}
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <Typography variant={'overline'}>
                            Last Updated
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <MetadataRenderer
                            project_id={project.project_id}
                            metadata_key={'last_updated'}
                            chips={false}
                          />
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
              <Grid item xs={12} sm={12} md={12} lg={4}>
                <RangeHeader
                  project={project}
                  handleAIEdit={handleNotebookTabChange}
                />
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={notebookTabValue} index={2} id={'notebook'}>
            {uiSpec !== null && <NotebookSettings uiSpec={uiSpec} />}
          </TabPanel>
        </Box>
      )}
    </Box>
  );
}
