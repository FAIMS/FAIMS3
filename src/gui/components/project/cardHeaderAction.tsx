import React, {useEffect} from 'react';
import {Link as RouterLink, NavLink} from 'react-router-dom';

import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  CircularProgress,
} from '@material-ui/core';
import {useTheme} from '@material-ui/core/styles';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import AddIcon from '@material-ui/icons/Add';
import SearchIcon from '@material-ui/icons/Search';
import SettingsIcon from '@material-ui/icons/Settings';
import MoreVertIcon from '@material-ui/icons/MoreVert';

import * as ROUTES from '../../../constants/routes';
import {ProjectInformation} from '../../../datamodel/ui';
import {ProjectUIViewsets} from '../../../datamodel/typesystem';
import {getUiSpecForProject} from '../../../uiSpecification';

type ProjectCardActionProps = {
  project: ProjectInformation;
};

export default function ProjectCardHeaderAction(props: ProjectCardActionProps) {
  const {project} = props;

  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));

  const [actionAnchor, setActionAnchor] = React.useState<null | HTMLElement>(
    null
  );

  const handleActionClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setActionAnchor(event.currentTarget);
  };

  const handleActionClose = () => {
    setActionAnchor(null);
  };

  const [createAnchor, setCreateAnchor] = React.useState<null | HTMLElement>(
    null
  );

  const handleCreateClose = () => {
    setCreateAnchor(null);
  };

  const handleCreateClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setCreateAnchor(event.currentTarget);
  };

  // viewsets and the list of visible views
  const [viewSets, setViewSets] = React.useState<
    null | [ProjectUIViewsets, string[]]
  >(null);

  useEffect(() => {
    getUiSpecForProject(project.project_id).then(uiSpec => {
      if (
        uiSpec.viewsets !== null ||
        uiSpec.viewsets !== null ||
        uiSpec.visible_types !== undefined ||
        uiSpec.visible_types !== undefined
      ) {
        setViewSets([uiSpec.viewsets, uiSpec.visible_types]);
      } else {
        console.error('Viewsets or visable types not set up:', uiSpec);
      }
    }, console.error);
  }, [project.project_id]);

  if (viewSets === null) {
    console.info('Viewsets is null for:', project.project_id);
    return <CircularProgress thickness={2} size={12} />;
  }

  return (
    <React.Fragment>
      {not_xs ? (
        <React.Fragment>
          <Box p={1}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<AddIcon />}
              // If the list of views hasn't loaded yet
              // we can still show this button, except it will
              // redirect to the Record creation without known type
              {...(viewSets[1].length === 1
                ? {
                    component: RouterLink,
                    to:
                      ROUTES.PROJECT +
                      project.project_id +
                      ROUTES.RECORD_CREATE +
                      viewSets[1],
                  }
                : {
                    onClick: handleCreateClick,
                  })}
            >
              New Record
            </Button>
            <Menu
              anchorEl={createAnchor}
              keepMounted
              open={Boolean(createAnchor)}
              onClose={handleCreateClose}
            >
              {viewSets[1].map(
                viewset_name =>
                  viewSets[0][viewset_name].is_visible !== false && (
                    <MenuItem
                      component={RouterLink}
                      to={
                        ROUTES.PROJECT +
                        project.project_id +
                        ROUTES.RECORD_CREATE +
                        viewset_name
                      }
                    >
                      {viewSets[0][viewset_name].label || viewset_name}
                    </MenuItem>
                  )
              )}
            </Menu>

            <IconButton
              component={RouterLink}
              to={ROUTES.PROJECT + project.project_id + ROUTES.PROJECT_SEARCH}
            >
              <SearchIcon />
            </IconButton>
            <IconButton
              component={RouterLink}
              to={ROUTES.PROJECT + project.project_id + ROUTES.PROJECT_SETTINGS}
            >
              <SettingsIcon />
            </IconButton>
          </Box>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <IconButton aria-label="settings" onClick={handleActionClick}>
            <MoreVertIcon />
          </IconButton>
          <Menu
            id="action-menu"
            anchorEl={actionAnchor}
            keepMounted
            open={Boolean(actionAnchor)}
            onClose={handleActionClose}
          >
            {viewSets[1].length === 1 ? (
              <MenuItem
                component={NavLink}
                to={
                  ROUTES.PROJECT +
                  project.project_id +
                  ROUTES.RECORD_CREATE +
                  viewSets[1]
                }
              >
                <ListItemIcon>
                  <AddIcon fontSize="small" />
                </ListItemIcon>
                New Record
              </MenuItem>
            ) : (
              <React.Fragment>
                {viewSets[1].map(
                  viewset_name =>
                    viewSets[0][viewset_name].is_visible !== false && (
                      <MenuItem
                        component={RouterLink}
                        to={
                          ROUTES.PROJECT +
                          project.project_id +
                          ROUTES.RECORD_CREATE +
                          viewset_name
                        }
                      >
                        New {viewSets[0][viewset_name].label || viewset_name}
                      </MenuItem>
                    )
                )}
              </React.Fragment>
            )}

            <MenuItem
              component={NavLink}
              to={ROUTES.PROJECT + project.project_id + ROUTES.PROJECT_SETTINGS}
            >
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              Project Settings
            </MenuItem>
          </Menu>
        </React.Fragment>
      )}
    </React.Fragment>
  );
}
