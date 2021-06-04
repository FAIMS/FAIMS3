import React from 'react';
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
} from '@material-ui/core';
import ShareIcon from '@material-ui/icons/Share';
import AddIcon from '@material-ui/icons/Add';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import {Link as RouterLink, NavLink} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';

import {useTheme} from '@material-ui/core/styles';
import useMediaQuery from '@material-ui/core/useMediaQuery';

import {ProjectInformation} from '../../../datamodel';

type ProjectCardActionProps = {
  project: ProjectInformation;
};

export default function ProjectCardHeaderAction(props: ProjectCardActionProps) {
  const {project} = props;

  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <React.Fragment>
      {not_xs ? (
        <React.Fragment>
          <Box p={1}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<AddIcon />}
              component={RouterLink}
              to={
                ROUTES.PROJECT + project.project_id + ROUTES.OBSERVATION_CREATE
              }
            >
              New Observation
            </Button>
          </Box>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <IconButton aria-label="settings" onClick={handleClick}>
            <MoreVertIcon />
          </IconButton>
          <Menu
            id="action-menu"
            anchorEl={anchorEl}
            keepMounted
            open={Boolean(anchorEl)}
            onClose={handleClose}
          >
            <MenuItem
              component={NavLink}
              to={
                ROUTES.PROJECT + project.project_id + ROUTES.OBSERVATION_CREATE
              }
            >
              <ListItemIcon>
                <AddIcon fontSize="small" />
              </ListItemIcon>
              New Observation
            </MenuItem>
            <MenuItem disabled={true}>
              <ListItemIcon>
                <ShareIcon fontSize="small" />
              </ListItemIcon>
              Share
            </MenuItem>
          </Menu>
        </React.Fragment>
      )}
    </React.Fragment>
  );
}
