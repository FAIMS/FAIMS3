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
import {ObservationForm} from '../components/observationForm';
import {getProjectInfo} from '../../databaseAccess';

export default function ObservationCreate() {
  const {listing_id_project_id} = useParams<{
    listing_id_project_id: string;
  }>();
  const project_info = getProjectInfo(listing_id_project_id);

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
          <Link
            component={RouterLink}
            to={ROUTES.PROJECT + listing_id_project_id}
          >
            Project {listing_id_project_id}
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
          {project_info !== null ? project_info.name : listing_id_project_id}{' '}
          project.
        </Typography>
      </Box>
      <Paper square>
        <Box p={3}>
          <ObservationForm
            listing_id_project_id={listing_id_project_id}
            observation_id={generateFAIMSDataID()}
            is_fresh={true}
          />
        </Box>
      </Paper>
    </Container>
  );
}
