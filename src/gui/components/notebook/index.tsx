import React, {useEffect, useState} from 'react';
import {
  Tabs,
  Tab,
  Typography,
  Box,
  Paper,
  Grid,
  CircularProgress,
  Table,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  IconButton,
} from '@mui/material';
import * as ROUTES from '../../../constants/routes';
import {ProjectUIViewsets} from '../../../datamodel/typesystem';
import {getUiSpecForProject} from '../../../uiSpecification';
import {ProjectInformation} from '../../../datamodel/ui';
import DraftsTable from './draft_table';
import {RecordsBrowseTable} from './table';
import RangeHeader from './range_header';
import MetadataRenderer from '../metadataRenderer';
import AddRecordButtons from './add_record_by_type';
import {Link as RouterLink} from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import NotebookSettings from './settings';

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
   *
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
        <CircularProgress size={12} thickness={4} />
      ) : (
        <React.Fragment>
          <Grid container spacing={{xs: 1, sm: 2, md: 3}}>
            <Grid item md={6} sm={12} xs={12}>
              <Typography variant={'h4'} gutterBottom>
                <Grid
                  container
                  direction="row"
                  justifyContent="flex-start"
                  alignItems="center"
                >
                  <Grid item>{project.name}</Grid>
                  <Grid item>
                    <IconButton
                      component={RouterLink}
                      to={
                        ROUTES.PROJECT +
                        project.project_id +
                        ROUTES.PROJECT_SEARCH
                      }
                    >
                      <SearchIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              </Typography>
            </Grid>
            <Grid item md={6} sm={12} xs={12}>
              <Box sx={{float: 'right'}}>
                <AddRecordButtons project={project} />
              </Box>
            </Grid>
          </Grid>

          <Box mt={2}>
            <Box mb={1}>
              <Tabs
                value={notebookTabValue}
                onChange={handleNotebookTabChange}
                aria-label="notebook tabs"
              >
                <Tab label="Info" {...a11yProps(0, 'notebook')} />
                <Tab label="Settings" {...a11yProps(1, 'notebook')} />
              </Tabs>
            </Box>
            <TabPanel value={notebookTabValue} index={0} id={'notebook'}>
              <Grid container spacing={{xs: 1, sm: 2, md: 3}}>
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant={'overline'}>Description</Typography>
                  <Box
                    component={Paper}
                    elevation={0}
                    variant={'outlined'}
                    p={2}
                  >
                    <Typography
                      variant="body2"
                      color="textPrimary"
                      gutterBottom
                    >
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
                    <Table size={'small'}>
                      <TableBody>
                        <TableRow>
                          <TableCell>
                            <Typography variant={'h6'}>Status</Typography>
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
                            <Typography variant={'h6'}>
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
                            <Typography variant={'h6'}>Project Lead</Typography>
                          </TableCell>
                          <TableCell>
                            <MetadataRenderer
                              project_id={project.project_id}
                              metadata_key={'project_lead'}
                              chips={false}
                            />
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={4}>
                  <Typography variant={'overline'}>Range Indices</Typography>
                  <RangeHeader
                    project={project}
                    handleAIEdit={handleNotebookTabChange}
                  />
                </Grid>
              </Grid>
              {/* Records/Drafts */}
              <Box mt={2}>
                <Box mb={1}>
                  <Tabs
                    value={recordDraftTabValue}
                    onChange={handleRecordDraftTabChange}
                    aria-label="notebook-records"
                  >
                    <Tab
                      label="Records"
                      {...a11yProps(0, 'notebook-records')}
                    />
                    <Tab label="Drafts" {...a11yProps(1, 'notebook-records')} />
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
              <NotebookSettings />
            </TabPanel>
          </Box>
        </React.Fragment>
      )}
    </Box>
  );
}
