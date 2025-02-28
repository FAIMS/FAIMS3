/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: navbar.tsx
 * Description:
 *   This contains the navbar React component, which allows users to navigate
 *   throughout the app.
 */
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AccountTree from '@mui/icons-material/AccountTree';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import MenuIcon from '@mui/icons-material/Menu';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  Box,
  CircularProgress,
  IconButton,
  ListItemButton,
  AppBar as MuiAppBar,
  Toolbar,
} from '@mui/material';
import Collapse from '@mui/material/Collapse';
import CssBaseline from '@mui/material/CssBaseline';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import React, {useState} from 'react';
import {Link as RouterLink} from 'react-router-dom';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '../../buildconfig';
import * as ROUTES from '../../constants/routes';
import {
  selectActiveServerId,
  selectIsAuthenticated,
} from '../../context/slices/authSlice';
import {Project} from '../../context/slices/projectSlice';
import {useAppSelector} from '../../context/store';
import SystemAlert from '../components/alert';
import {AppBarHeading} from '../components/app-bar/app-bar-heading';
import AppBarAuth from '../components/authentication/appbarAuth';
import SyncStatus from '../components/sync';

const drawerWidth = 240;

/**
 * Represents the properties for a menu list item.
 */
type ProjectListItemProps = {
  title: string;
  icon: any;
  to: string;
  disabled: boolean;
};

/**
 * Represents the type of icon used in the navigation menu.
 */
type IconType =
  | undefined
  | string
  | number
  | React.ReactElement<any, string | React.JSXElementConstructor<any>>;

type MenuItemProps = {
  nested?: any;
  title: string;
  to: string;
  disabled: boolean;
  icon: IconType;
};

/**
 * Retrieves a list of nested menu items to be displayed in the navigation menu.
 */
function getNestedProjects(pouchProjectList: Project[]) {
  const projectListItems: ProjectListItemProps[] = [];
  pouchProjectList.map(project_info => {
    projectListItems.push({
      title: project_info.metadata.name,
      icon: <DescriptionIcon />,
      to:
        ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
        project_info.serverId +
        '/' +
        project_info.projectId,
      disabled: false,
    });
  });
  return {
    title: `${NOTEBOOK_NAME_CAPITALIZED}s`,
    icon: <AccountTree />,
    nested: projectListItems,
    to: ROUTES.NOTEBOOK_LIST_ROUTE,
    disabled: false,
  };
}

/**
 * MainAppBar component handles the display of the navigation drawer and the app bar.
 * It includes top menu items, bottom menu items, and conditional rendering based on authentication status.
 * This version uses inline sx props for styling.
 */
export default function MainAppBar() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const activeServerId = useAppSelector(selectActiveServerId);
  const projectList = useAppSelector(state =>
    activeServerId
      ? Object.values(state.projects.servers[activeServerId]?.projects ?? {})
      : []
  );

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const toggle = () => setIsOpen(!isOpen);

  const topMenuItems: Array<MenuItemProps> = [
    {
      title: 'Home',
      icon: <DashboardIcon />,
      to: ROUTES.INDEX,
      disabled: !isAuthenticated,
    },
    projectList === null
      ? {
          title: `Loading ${NOTEBOOK_NAME}s...`,
          icon: <AccountTree />,
          to: '/',
          disabled: true,
        }
      : isAuthenticated
        ? getNestedProjects(projectList)
        : {
            title: `${NOTEBOOK_NAME_CAPITALIZED}s`,
            icon: <AccountTree />,
            to: '/',
            disabled: true,
          },
  ];

  const bottomMenuItems: Array<MenuItemProps> = [
    {
      title: 'About Build',
      icon: <SettingsIcon />,
      to: ROUTES.ABOUT_BUILD,
      disabled: false,
    },
    isAuthenticated
      ? {
          title: 'Sign out',
          icon: <AccountCircleIcon />,
          to: ROUTES.SIGN_IN,
          disabled: false,
        }
      : {
          title: 'Sign out',
          icon: <AccountCircleIcon />,
          to: '/',
          disabled: true,
        },
  ];

  const [nestedMenuOpen, setNestedMenuOpen] = useState<{
    [key: string]: boolean;
  }>({Projects: false});

  return (
    <React.Fragment>
      <div style={{display: 'flex', boxShadow: 'none'}}>
        <CssBaseline />
        <MuiAppBar
          position="relative"
          sx={{
            boxShadow: 'none',
          }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              onClick={toggle}
              edge="start"
              sx={{
                mr: 0,
                paddingLeft: 1,
                paddingRight: 0,
                display: isOpen ? 'hidden' : 'flex',
              }}
            >
              <MenuIcon />
            </IconButton>
            <AppBarHeading link={ROUTES.INDEX} />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                overflow: 'hidden',
              }}
            >
              {isAuthenticated ? <SyncStatus /> : ''}
              <AppBarAuth />
            </div>
          </Toolbar>
        </MuiAppBar>
        <Drawer
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            zIndex: 1500,
          }}
          variant="temporary"
          anchor="left"
          open={isOpen}
          ModalProps={{onBackdropClick: toggle}}
          PaperProps={{
            sx: {
              width: drawerWidth,
              height: '100vh',
              boxShadow: '2px 0 10px rgba(0, 0, 0, 0.3)',
              borderRight: '1px solid rgba(0, 0, 0, 0.1)',
            },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              px: 1,
              minHeight: '64px',
              justifyContent: 'flex-end',
            }}
          >
            <IconButton onClick={toggle} size="large">
              <ChevronLeftIcon />
            </IconButton>
          </Box>
          <Divider />

          <List>
            {topMenuItems.map((item: MenuItemProps) => {
              return Object.prototype.hasOwnProperty.call(item, 'nested') ? (
                <React.Fragment key={'menuItem' + item.title}>
                  <ListItemButton
                    onClick={() => {
                      setNestedMenuOpen(prevNestedMenuOpen => ({
                        ...prevNestedMenuOpen,
                        [item.title]: !prevNestedMenuOpen[item.title],
                      }));
                    }}
                    disabled={item.disabled}
                  >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText
                      sx={{
                        '& .MuiListItemText-primary': {
                          fontSize: '1.1rem',
                          fontWeight: 'bold',
                          color: 'rgba(0, 0, 0, 0.54)',
                        },
                      }}
                    >
                      {item.title}{' '}
                    </ListItemText>
                    {item.nested.length === 0 ? (
                      <CircularProgress size={12} thickness={4} />
                    ) : nestedMenuOpen[item.title] ? (
                      <ExpandLess />
                    ) : (
                      <ExpandMore />
                    )}
                  </ListItemButton>
                  <Collapse
                    in={nestedMenuOpen[item.title]}
                    timeout="auto"
                    unmountOnExit
                    key={'menuItemCollapse' + item.title}
                  >
                    <List component="div" disablePadding dense={true}>
                      {item.nested.map(
                        (nestedItem: {
                          icon: IconType;
                          title: string;
                          to: string;
                        }) => (
                          <ListItemButton
                            sx={{pl: 4}}
                            key={
                              'nestedMenuItem' + item.title + nestedItem.title
                            }
                            to={nestedItem.to}
                            component={RouterLink}
                            disabled={item.disabled}
                            onClick={toggle}
                          >
                            <ListItemIcon>{nestedItem.icon}</ListItemIcon>
                            <ListItemText
                              sx={{
                                '& .MuiListItemText-primary': {
                                  fontSize: '1.1rem',
                                  fontWeight: 'bold',
                                  color: 'rgba(0, 0, 0, 0.54)',
                                },
                              }}
                              primary={nestedItem.title}
                            />
                          </ListItemButton>
                        )
                      )}
                    </List>
                  </Collapse>
                </React.Fragment>
              ) : (
                <ListItemButton
                  key={item.title}
                  to={item.to}
                  component={RouterLink}
                  disabled={item.disabled}
                  onClick={toggle}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText
                    sx={{
                      '& .MuiListItemText-primary': {
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        color: 'rgba(0, 0, 0, 0.54)',
                      },
                    }}
                    primary={item.title}
                  />
                </ListItemButton>
              );
            })}
          </List>
          <Box sx={{mt: 'auto'}}>
            <Divider />
            <List
              sx={theme => ({
                borderTop: `1px solid ${theme.palette.divider}`,
                py: 2,
              })}
            >
              {bottomMenuItems.map(
                (item: {
                  title: string;
                  icon: IconType;
                  disabled: boolean;
                  to: any;
                }) => (
                  <ListItemButton
                    key={item.title}
                    disabled={item.disabled}
                    to={item.to}
                    component={RouterLink}
                    onClick={toggle}
                  >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText
                      sx={{
                        '& .MuiListItemText-primary': {
                          fontSize: '1.1rem',
                          fontWeight: 'bold',
                          color: 'rgba(0, 0, 0, 0.54)',
                        },
                      }}
                      primary={item.title}
                    />
                  </ListItemButton>
                )
              )}
            </List>
          </Box>
        </Drawer>
      </div>
      <SystemAlert />
    </React.Fragment>
  );
}
