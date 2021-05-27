import React from 'react';
import {
  Box,
  Breadcrumbs,
  Container,
  Typography,
  Paper,
  Link,
} from '@material-ui/core';
import {Link as RouterLink} from 'react-router-dom';
import {useParams} from 'react-router-dom';
import * as ROUTES from '../../constants/routes';
import {generateFAIMSDataID} from '../../dataStorage';
import {ObservationForm} from '../components/observation/form';
import {getProjectInfo} from '../../databaseAccess';
import {ProjectID} from '../../datamodel';

export default function ObservationCreate() {
  const {project_id} = useParams<{
    project_id: ProjectID;
  }>();
  const project_info = getProjectInfo(project_id);

  return (
    <Container maxWidth="lg">
      <Box display="flex" flexDirection="row-reverse" p={1} m={1}>
        <Breadcrumbs aria-label="breadcrumb">
          <Link component={RouterLink} to={ROUTES.INDEX}>
            Index
          </Link>
          <Link component={RouterLink} to={ROUTES.PROJECT_LIST}>
            Projects
          </Link>
          <Link component={RouterLink} to={ROUTES.PROJECT + project_id}>
            Project {project_info !== null ? project_info.name : project_id}
          </Link>
          <Typography color="textPrimary">New Observation</Typography>
        </Breadcrumbs>
      </Box>
      <Box mb={2}>
        <Typography variant={'h2'} component={'h1'}>
          Record Observation
        </Typography>
        <Typography variant={'subtitle1'} gutterBottom>
          Add an observation for the{' '}
          {project_info !== null ? project_info.name : project_id} project.
        </Typography>
      </Box>
      <Paper square>
        <Box p={3}>
          <ObservationForm
            project_id={project_id}
            observation_id={generateFAIMSDataID()}
            is_fresh={true}
          />
        </Box>
      </Paper>
    </Container>
  );
}
