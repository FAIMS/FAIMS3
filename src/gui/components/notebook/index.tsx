import React, {useEffect, useState} from 'react';
import {
  Divider,
  Tabs,
  Tab,
  Typography,
  Box,
  Paper,
  Grid,
  Table,
  TableBody,
  TableRow,
  TableCell,
  AppBar,
  TableContainer,
} from '@mui/material';
import {ProjectUIViewsets} from '../../../datamodel/typesystem';
import {getUiSpecForProject} from '../../../uiSpecification';
import {ProjectInformation} from '../../../datamodel/ui';
import DraftsTable from './draft_table';
import {RecordsBrowseTable} from './record_table';
import RangeHeader from './range_header';
import MetadataRenderer from '../metadataRenderer';
import AddRecordButtons from './add_record_by_type';
import NotebookSettings from './settings';
import {useTheme} from '@mui/material/styles';
import DraftTabBadge from './draft_tab_badge';
import useMediaQuery from '@mui/material/useMediaQuery';
import CircularLoading from '../ui/circular_loading';
import ProjectStatus from './settings/status';

interface TabPanelProps {
  children?: React.ReactNode;
  id: string;
  index: number;
  value: number;
}

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

function a11yProps(index: number, id: string) {
  /**
   * Accessibility props
   */
  return {
    id: `${id}-tab-${index}`,
    'aria-controls': `${id}-tabpanel-${index}`,
  };
}

type NotebookComponentProps = {
  project: ProjectInformation;
};
export default function NotebookComponent(props: NotebookComponentProps) {
  /**
   * Notebook component. Consolidating into three tabs; records, info (meta) and settings.
   * Display customized for smaller screens
   */
  const [notebookTabValue, setNotebookTabValue] = React.useState(0);
  const [recordDraftTabValue, setRecordDraftTabValue] = React.useState(0);

  const handleRecordDraftTabChange = (
    event: React.SyntheticEvent,
    newValue: number
  ) => {
    setRecordDraftTabValue(newValue);
  };

  const handleNotebookTabChange = (
    event: React.SyntheticEvent,
    newValue: number
  ) => {
    setNotebookTabValue(newValue);
  };

  const {project} = props;
  const [loading, setLoading] = useState(true);
  const [viewsets, setViewsets] = useState<null | ProjectUIViewsets>(null);
  const theme = useTheme();
  const mq_above_md = useMediaQuery(theme.breakpoints.up('md'));

  useEffect(() => {
    let isactive = true;
    if (typeof project !== 'undefined' && Object.keys(project).length > 0) {
      if (isactive) setLoading(false);
    }
    return () => {
      isactive = false;
    }; // cleanup toggles value,
  }, [project]);

  useEffect(() => {
    let isactive = true;
    if (isactive)
      getUiSpecForProject(project.project_id).then(
        uiSpec => {
          setViewsets(uiSpec.viewsets);
        },
        () => {}
      );
    return () => {
      isactive = false;
    }; // cleanup toggles value,
  }, [project.project_id]);

  return (
    <Box>
      {loading ? (
        <CircularLoading label={'Notebook is loading'} />
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
                aria-label="notebook tabs"
                indicatorColor="secondary"
                textColor="inherit"
                variant="scrollable"
                scrollButtons="auto"
                // centered={mq_above_md ? false : true}
              >
                <Tab label="Records" {...a11yProps(0, 'notebook')} />
                <Tab label="Info" {...a11yProps(1, 'notebook')} />
                <Tab label="Settings" {...a11yProps(2, 'notebook')} />
              </Tabs>
            </AppBar>
          </Box>
          <TabPanel value={notebookTabValue} index={0} id={'notebook'}>
            {/* Add Record Buttons */}
            <Box>
              <Typography variant={'overline'} sx={{marginTop: '-8px'}}>
                Add New Record
              </Typography>
              <AddRecordButtons project={project} />
            </Box>
            {/* Records/Drafts */}
            <Box mt={2}>
              <Box mb={1}>
                <Tabs
                  value={recordDraftTabValue}
                  onChange={handleRecordDraftTabChange}
                  aria-label="notebook-records"
                >
                  <Tab label="Records" {...a11yProps(0, 'notebook-records')} />
                  <Tab
                    label={<DraftTabBadge project_id={project.project_id} />}
                    {...a11yProps(1, 'notebook-records')}
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
                />
              </TabPanel>
            </Box>
          </TabPanel>
          <TabPanel value={notebookTabValue} index={1} id={'notebook'}>
            <Grid container spacing={{xs: 1, sm: 2, md: 3}}>
              <Grid item xs={12} sm={6} md={6} lg={4}>
                <Box component={Paper} elevation={0} variant={'outlined'} p={2}>
                  <Typography variant={'h6'} sx={{mb: 2}}>
                    Description
                  </Typography>
                  <Typography variant="body2" color="textPrimary" gutterBottom>
                    {project.description}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant={'overline'}>About</Typography>
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
            <NotebookSettings />
          </TabPanel>
        </Box>
      )}
    </Box>
  );
}
