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
  CircularProgress,
  IconButton,
  ListItemButton,
  AppBar as MuiAppBar,
  Toolbar,
  createTheme,
} from '@mui/material';
import Collapse from '@mui/material/Collapse';
import CssBaseline from '@mui/material/CssBaseline';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import clsx from 'clsx';
import React, {useContext, useState} from 'react';
import {createUseStyles as makeStyles} from 'react-jss';
import {Link as RouterLink} from 'react-router-dom';
import {
  NOTEBOOK_NAME,
  NOTEBOOK_NAME_CAPITALIZED,
  OFFLINE_MAPS,
} from '../../buildconfig';
import * as ROUTES from '../../constants/routes';
import {ProjectsContext} from '../../context/projects-context';
import {
  selectActiveServerId,
  selectIsAuthenticated,
} from '../../context/slices/authSlice';
import {useAppSelector} from '../../context/store';
import {ProjectExtended} from '../../types/project';
import SystemAlert from '../components/alert';
import {AppBarHeading} from '../components/app-bar/app-bar-heading';
import AppBarAuth from '../components/authentication/appbarAuth';
import SyncStatus from '../components/sync';

/**
 * Represents the properties for a menu list item.
 * @typedef {Object} ProjectListItemProps
 * @property {string} title - The title of the menuitem.
 * @property {React.ReactElement} icon - The icon associated with the menuitem.
 * @property {string} to - The path to navigate to for this menuitem.
 * @property {boolean} disabled - Whether the menuitem is disabled in the list.
 */

type ProjectListItemProps = {
  title: string;
  icon: any;
  to: string;
  disabled: boolean;
};

/**
 * Represents the type of icon used in the navigation menu.
 * @typedef {React.ReactElement | string | number | undefined} IconType
 */ type IconType =
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

const drawerWidth = 240;
const theme = createTheme();

const useStyles = makeStyles({
  root: {
    display: 'flex',
    boxShadow: 'none',
  },
  appBar: {
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    boxShadow: 'none',
  },
  appBarShift: {
    width: `calc(100% - ${drawerWidth}px)`,
    marginLeft: drawerWidth,
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  menuButton: {
    marginRight: theme.spacing(2),
  },
  hide: {
    display: 'none',
  },
  drawer: {
    width: drawerWidth,
    flexShrink: 0,
    zIndex: 1500,
  },
  drawerPaper: {
    width: drawerWidth,
    height: '100vh',
    boxShadow: '2px 0 10px rgba(0, 0, 0, 0.3)',
    borderRight: '1px solid rgba(0, 0, 0, 0.1)',
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 1),
    minHeight: '64px',
    justifyContent: 'flex-end',
  },
  content: {
    flexGrow: 1,
    padding: theme.spacing(3),
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    marginLeft: -drawerWidth,
  },
  contentShift: {
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginLeft: 0,
  },
  nested: {
    paddingLeft: theme.spacing(4),
  },
  /**
   * Styles for the ListItemText component in the navigation items.
   * @type {Object}
   */
  listItemText: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: 'rgba(0, 0, 0, 0.54)', // Use the same gray color as the icons (this is a common MUI icon color)
  },
  /**
   * Styles for the bottom section options in the drawer.
   * Includes padding and a border at the top.
   * @type {Object}
   */
  bottomOptions: {
    borderTop: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(2, 0),
  },
  /**
   * Ensures that the bottom section of the drawer is positioned at the bottom of the viewport.
   * @type {Object}
   */
  bottomSection: {
    marginTop: 'auto',
  },
});

/**
 * Retrieves a list of nested menu items to be displayed in the navigation menu.
 * @function
 * @param {ProjectInformation[]} pouchProjectList - List of project information.
 * @returns {MenuItemProps} - The item for nested menu.
 */

function getNestedProjects(pouchProjectList: ProjectExtended[]) {
  const projectListItems: ProjectListItemProps[] = [];
  pouchProjectList.map(project_info => {
    projectListItems.push({
      title: project_info.name,
      icon: <DescriptionIcon />,
      to: ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE + project_info.project_id,
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
 *
 * @component
 * @returns {JSX.Element} - The rendered MainAppBar component.
 */
export default function MainAppBar() {
  const classes = useStyles();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const activeServerId = useAppSelector(selectActiveServerId);

  // get the list of activated projects
  const projectList = useContext(ProjectsContext).projects.filter(
    p => p.activated && p.listing === activeServerId
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
  ];
  if (OFFLINE_MAPS)
    bottomMenuItems.push({
      title: 'Offline Maps',
      icon: <SettingsIcon />,
      to: ROUTES.OFFLINE_MAPS,
      disabled: false,
    });

  if (isAuthenticated)
    bottomMenuItems.push({
      title: 'Sign out',
      icon: <AccountCircleIcon />,
      to: ROUTES.SIGN_IN,
      disabled: false,
    });
  else
    bottomMenuItems.push({
      title: 'Sign out',
      icon: <AccountCircleIcon />,
      to: '/',
      disabled: true,
    });

  const [nestedMenuOpen, setNestedMenuOpen] = useState<{
    [key: string]: boolean;
  }>({Projects: false});

  return (
    <React.Fragment>
      <div className={classes.root}>
        <CssBaseline />
        <MuiAppBar
          position="relative"
          className={clsx(classes.appBar, {
            [classes.appBarShift]: isOpen,
          })}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              onClick={toggle}
              edge="start"
              className={clsx(classes.menuButton, isOpen && classes.hide)}
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
          className={classes.drawer}
          variant="temporary"
          anchor="left"
          open={isOpen}
          ModalProps={{onBackdropClick: toggle}}
          classes={{
            paper: classes.drawerPaper,
          }}
        >
          <div className={classes.drawerHeader}>
            <IconButton onClick={toggle} size="large">
              <ChevronLeftIcon />
            </IconButton>
          </div>
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
                    <ListItemText classes={{primary: classes.listItemText}}>
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
                            className={classes.nested}
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
                              primary={nestedItem.title}
                              classes={{primary: classes.listItemText}}
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
                    primary={item.title}
                    classes={{primary: classes.listItemText}}
                  />
                </ListItemButton>
              );
            })}
          </List>
          <div className={classes.bottomSection}>
            <Divider />
            <List className={classes.bottomOptions}>
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
                      primary={item.title}
                      classes={{primary: classes.listItemText}}
                    />
                  </ListItemButton>
                )
              )}
            </List>
          </div>
        </Drawer>
      </div>
      <SystemAlert />
    </React.Fragment>
  );
}
