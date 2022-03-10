import React from 'react';
import {Link as RouterLink} from 'react-router-dom';

import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  CircularProgress,
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';

import * as ROUTES from '../../../constants/routes';
import {ProjectInformation} from '../../../datamodel/ui';
import {getUiSpecForProject} from '../../../uiSpecification';
import {listenProjectDB} from '../../../sync';
import {useEventedPromise} from '../../pouchHook';

type ProjectCardActionProps = {
  project: ProjectInformation;
};

// export default function ProjectCardHeaderAction(props: ProjectCardActionProps) {
//   const {project} = props;
//   const project_id = project.project_id;

//   const theme = useTheme();
//   //const not_xs = useMediaQuery(theme.breakpoints.up('sm'));
//   const not_xs = true;

//   const [actionAnchor, setActionAnchor] = React.useState<null | HTMLElement>(
//     null
//   );

//   const handleActionClick = (event: React.MouseEvent<HTMLButtonElement>) => {
//     setActionAnchor(event.currentTarget);
//   };

//   const handleActionClose = () => {
//     setActionAnchor(null);
//   };

//   const [createAnchor, setCreateAnchor] = React.useState<null | HTMLElement>(
//     null
//   );

//   const handleCreateClose = () => {
//     setCreateAnchor(null);
//   };

//   const handleCreateClick = (event: React.MouseEvent<HTMLButtonElement>) => {
//     setCreateAnchor(event.currentTarget);
//   };

//   const ui_spec = useEventedPromise(
//     getUiSpecForProject,
//     listenProjectDB.bind(null, project_id, {since: 'now'}),
//     true,
//     [project_id],
//     project_id
//   );

//   if (ui_spec.error) {
//     console.error(`Error in gettings UISpec in ${project_id}`, ui_spec.error);
//   }

//   if (ui_spec.loading || ui_spec.value === undefined) {
//     console.debug('Ui spec for', project_id, ui_spec);
//     return <CircularProgress thickness={2} size={12} />;
//   }
//   const viewsets = ui_spec.value.viewsets;
//   const visible_types = ui_spec.value.visible_types;

//   return (
//     <React.Fragment>
//       {not_xs ? (
//         <ProjectCardHeaderAction_Common {...props}/>
//       ) : (
//         <React.Fragment>
//           <IconButton aria-label="settings" onClick={handleActionClick}>
//             <MoreVertIcon />
//           </IconButton>
//           <Menu
//             id="action-menu"
//             anchorEl={actionAnchor}
//             keepMounted
//             open={Boolean(actionAnchor)}
//             onClose={handleActionClose}
//           >
//             {visible_types.length === 1 ? (
//               <MenuItem
//                 component={NavLink}
//                 to={
//                   ROUTES.PROJECT +
//                   project_id +
//                   ROUTES.RECORD_CREATE +
//                   visible_types
//                 }
//               >
//                 <ListItemIcon>
//                   <AddIcon fontSize="small" />
//                 </ListItemIcon>
//                 New Record
//               </MenuItem>
//             ) : (
//               <React.Fragment>
//                 {visible_types.map(
//                   viewset_name =>
//                     viewsets[viewset_name].is_visible !== false && (
//                       <MenuItem
//                         component={RouterLink}
//                         to={
//                           ROUTES.PROJECT +
//                           project.project_id +
//                           ROUTES.RECORD_CREATE +
//                           viewset_name
//                         }
//                         key={viewset_name}
//                       >
//                         New {viewsets[viewset_name].label || viewset_name}
//                       </MenuItem>
//                     )
//                 )}
//               </React.Fragment>
//             )}

//             <MenuItem
//               component={NavLink}
//               to={ROUTES.PROJECT + project_id + ROUTES.PROJECT_SETTINGS}
//             >
//               <ListItemIcon>
//                 <SettingsIcon fontSize="small" />
//               </ListItemIcon>
//               Project Settings
//             </MenuItem>
//           </Menu>
//         </React.Fragment>
//       )}
//     </React.Fragment>
//   );
// }

export default function ProjectCardHeaderAction(props: ProjectCardActionProps) {
  const {project} = props;
  const project_id = project.project_id;

  const [createAnchor, setCreateAnchor] = React.useState<null | HTMLElement>(
    null
  );

  const handleCreateClose = () => {
    setCreateAnchor(null);
  };

  const handleCreateClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setCreateAnchor(event.currentTarget);
  };

  const ui_spec = useEventedPromise(
    getUiSpecForProject,
    listenProjectDB.bind(null, project_id, {since: 'now', live: true}),
    true,
    [project_id],
    project_id
  );

  if (ui_spec.error) {
    console.error(`Error in gettings UISpec in ${project_id}`, ui_spec.error);
  }

  if (ui_spec.loading || ui_spec.value === undefined) {
    console.debug('Ui spec for', project_id, ui_spec);
    return <CircularProgress thickness={2} size={12} />;
  }
  const viewsets = ui_spec.value.viewsets;
  const visible_types = ui_spec.value.visible_types;

  return (
    <React.Fragment>
      <Box p={1}>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<AddIcon />}
          // If the list of views hasn't loaded yet
          // we can still show this button, except it will
          // redirect to the Record creation without known type
          {...(visible_types.length === 1
            ? {
                component: RouterLink,
                to:
                  ROUTES.PROJECT +
                  project_id +
                  ROUTES.RECORD_CREATE +
                  visible_types,
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
          {visible_types.map(
            viewset_name =>
              viewsets[viewset_name].is_visible !== false && (
                <MenuItem
                  component={RouterLink}
                  to={
                    ROUTES.PROJECT +
                    project.project_id +
                    ROUTES.RECORD_CREATE +
                    viewset_name
                  }
                  key={viewset_name}
                >
                  {viewsets[viewset_name].label || viewset_name}
                </MenuItem>
              )
          )}
        </Menu>

        <IconButton
          component={RouterLink}
          to={ROUTES.PROJECT + project.project_id + ROUTES.PROJECT_SEARCH}
          size="large"
        >
          <SearchIcon />
        </IconButton>
        <IconButton
          component={RouterLink}
          to={ROUTES.PROJECT + project_id + ROUTES.PROJECT_SETTINGS}
          size="large"
        >
          <SettingsIcon />
        </IconButton>
      </Box>
    </React.Fragment>
  );
}
