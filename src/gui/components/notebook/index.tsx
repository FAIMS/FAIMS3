import React, {useEffect, useState} from 'react';
import {
  Avatar,
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
} from '@mui/material';
import * as ROUTES from '../../../constants/routes';
import {ProjectUIViewsets} from '../../../datamodel/typesystem';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {getUiSpecForProject} from '../../../uiSpecification';
import {ProjectInformation} from '../../../datamodel/ui';
import DraftsTable from '../record/draft_table';
import {RecordsBrowseTable} from '../record/table';
import ProjectCardHeaderAction from '../project/cardHeaderAction';
import RangeHeader from '../project/RangeHeader';
import MetadataRenderer from '../metadataRenderer';
import AddRecordButtons from "./add_record_types";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const {children, value, index, ...other} = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  /**
   * Accessibility props
   */
  return {
    id: `notebook-tab-${index}`,
    'aria-controls': `notebook-tabpanel-${index}`,
  };
}

type NotebookComponentProps = {
  project: ProjectInformation;
};
export default function NotebookComponent(props: NotebookComponentProps) {
  /**
   *
   */
  const [value, setValue] = React.useState(0);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const {project} = props;

  const [loading, setLoading] = useState(true);
  const project_url = ROUTES.PROJECT + project.project_id;
  const [viewsets, setViewsets] = useState<null | ProjectUIViewsets>(null);
  const theme = useTheme();

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
          <Grid container spacing={3}>
            <Grid item md={6} sm={12} xs={12}>
              <Typography variant={'h4'} gutterBottom>
                {project.name}
              </Typography>
              <Typography variant="body2" color="textPrimary" gutterBottom>
                {project.description}
              </Typography>
            </Grid>
            <Grid item md={6} sm={12} xs={12}>
              <AddRecordButtons project={project}/>
              <ProjectCardHeaderAction project={project} />
            </Grid>
            <Grid item md={4} sm={6} xs={12}>
              <TableContainer
                component={Paper}
                elevation={0}
                variant={'outlined'}
              >
                <Table size={'small'}>
                  <TableBody>
                    <TableRow>
                      <TableCell><Typography variant={'h6'}>Status</Typography></TableCell>
                      <TableCell>
                        <MetadataRenderer
                          project_id={project.project_id}
                          metadata_key={'project_status'}
                          chips={false}
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Typography variant={'h6'}>Lead Institution</Typography></TableCell>
                      <TableCell>
                        <MetadataRenderer
                          project_id={project.project_id}
                          metadata_key={'lead_institution'}
                          chips={false}
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Typography variant={'h6'}>Project Lead</Typography></TableCell>
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
            <Grid item md={8} sm={6} xs={12}>
              <Box component={Paper} elevation={0} variant={'outlined'} p={2}>
                <Typography variant={'body2'}>
                  <RangeHeader project={project} />
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* Records/Drafts */}
          <Box mt={2}>
            <Box>
              <Tabs
                value={value}
                onChange={handleChange}
                aria-label="notebook tabs"
              >
                <Tab label="Records" {...a11yProps(0)} />
                <Tab label="Drafts" {...a11yProps(1)} />
              </Tabs>
            </Box>
            <TabPanel value={value} index={0}>
              <RecordsBrowseTable
                project_id={project.project_id}
                maxRows={25}
                viewsets={viewsets}
                filter_deleted={true}
              />
            </TabPanel>
            <TabPanel value={value} index={1}>
              <DraftsTable
                project_id={project.project_id}
                maxRows={25}
                viewsets={viewsets}
              />
            </TabPanel>
          </Box>
        </React.Fragment>
      )}
    </Box>
  );
}
