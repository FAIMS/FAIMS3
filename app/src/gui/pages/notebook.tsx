// SPDX-License-Identifier: Apache-2.0

/**
 * Description:
 * Name: Notebook component
 * This component displays detailed information about a specific notebook
 * in a project. It handles loading, error states, and fetches project
 * information using the project ID from the URL. It also provides navigation
 * back to the list of notebooks and displays the notebook's active status.
 *
 * When the project is absent from Redux (upstream archival/deletion), shows
 * {@link NotebookUnavailable} instead of an infinite loading spinner.
 *
 * Unactivated notebooks cannot use the record UI — deep links redirect home,
 * except a never-readable (activation-blocked) notebook, which may open so
 * the compatibility skeleton and diagnostic report are reachable.
 *
 * Dependencies:
 * - React hooks: useState, useEffect
 * - React Router: useParams, useNavigate
 * - Material UI: Box, Typography, Chip, IconButton, CircularProgress
 */
import {Stack, Typography} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useEffect} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import * as ROUTES from '../../constants/routes';
import {isNotebookActivationBlocked} from '../../context/slices/helpers/notebookDefinition';
import {useAppSelector} from '../../context/store';
import {removedNotebookUnavailableCopy} from '../../utils/remoteProjectRemoval';
import NotebookQuickShare from '../components/notebook/settings/quickShare';
import BackButton from '../components/ui/BackButton';
import NotFound404 from './404';
import {NotebookView} from '../components/notebook/notebookView';

/** Shown when the URL names a notebook that no longer exists locally. */
function NotebookUnavailable() {
  return (
    <Stack spacing={2}>
      <BackButton link={ROUTES.NOTEBOOK_LIST_ROUTE} />
      <Typography variant="h5">
        {removedNotebookUnavailableCopy.title}
      </Typography>
      <Typography color="text.secondary">
        {removedNotebookUnavailableCopy.message}
      </Typography>
    </Stack>
  );
}

export default function Notebook() {
  const theme = useTheme();
  const navigate = useNavigate();
  const {serverId, projectId} = useParams<{
    projectId: string;
    serverId: string;
  }>();
  const project = useAppSelector(state =>
    serverId && projectId
      ? state.projects.servers[serverId]?.projects[projectId]
      : undefined
  );
  const largerThanMedium = useMediaQuery(theme.breakpoints.up('md'));

  const canViewWithoutActivation = isNotebookActivationBlocked(project);

  // Record views require an activated local database — send deep links back
  // home, unless this is a never-readable design we still need to explain.
  useEffect(() => {
    if (project && !project.isActivated && !canViewWithoutActivation) {
      navigate(ROUTES.NOTEBOOK_LIST_ROUTE, {replace: true});
    }
  }, [project, canViewWithoutActivation, navigate]);

  if (!projectId || !serverId) return <NotFound404 />;

  // Project dropped from store while this route was open (see remoteProjectRemoval).
  if (!project) {
    return <NotebookUnavailable />;
  }

  if (!project.isActivated && !canViewWithoutActivation) {
    return null;
  }

  // back button goes to the notebook list page
  const backLink = ROUTES.NOTEBOOK_LIST_ROUTE;

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} sx={{alignItems: 'center'}}>
        <BackButton link={backLink} />

        <Typography
          variant={largerThanMedium ? 'h3' : 'h4'}
          component="div"
          sx={{
            fontWeight: 'bold',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0,
          }}
        >
          {project.name}
        </Typography>

        <NotebookQuickShare project={project} />
      </Stack>

      <NotebookView project={project} />
    </Stack>
  );
}
