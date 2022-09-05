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

import React, {useState} from 'react';
import {Link as RouterLink, NavLink} from 'react-router-dom';
import {
  AppBar as MuiAppBar,
  CircularProgress,
  IconButton,
  Toolbar,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import makeStyles from '@mui/styles/makeStyles';
import CssBaseline from '@mui/material/CssBaseline';
import clsx from 'clsx';
import Collapse from '@mui/material/Collapse';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import AddIcon from '@mui/icons-material/Add';
import HomeIcon from '@mui/icons-material/Home';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import DescriptionIcon from '@mui/icons-material/Description';
import ListItemIcon from '@mui/material/ListItemIcon';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import AccountTree from '@mui/icons-material/AccountTree';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ListItemText from '@mui/material/ListItemText';

import * as ROUTES from '../../constants/routes';
import {SHOW_NEW_NOTEBOOK} from '../../buildconfig';
import {getProjectList, listenProjectList} from '../../databaseAccess';
import SystemAlert from '../components/alert';
import {ProjectInformation} from '../../datamodel/ui';
import {useEventedPromise} from '../pouchHook';
import AppBarAuth from '../components/authentication/appbarAuth';
import {TokenContents} from '../../datamodel/core';
import {checkToken} from '../../utils/helpers';
import ConnectedStatus from '../components/authentication/connectedStatus';
import SyncStatus from '../components/authentication/syncStatus';

// type NavBarState = {
//   topMenuItems: any;
//   bottomMenuItems: any;
//   open: boolean;
//   nestedMenuOpen: any;
// };

type ProjectListItemProps = {
  title: string;
  icon: any;
  to: string;
  disabled: boolean;
};
type MenuItemProps = {
  nested?: any;
  title: string;
  to: string;
  disabled: boolean;
  icon: React.ReactChild | undefined;
};

const drawerWidth = 240;

const useStyles = makeStyles(theme => ({
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
  },
  drawerPaper: {
    width: drawerWidth,
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 1),
    // necessary for content to be below app bar
    minHeight: '64px',
    // ...theme.mixins.toolbar,
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
}));

function getNestedProjects(pouchProjectList: ProjectInformation[]) {
  const projectListItems: ProjectListItemProps[] = [];
  pouchProjectList.map(project_info => {
    projectListItems.push({
      title: project_info.name,
      icon: <DescriptionIcon />,
      to: ROUTES.PROJECT + project_info.project_id,
      disabled: false,
    });
  });
  return {
    title: 'Notebooks',
    icon: <AccountTree />,
    nested: projectListItems,
    to: ROUTES.PROJECT_LIST,
    disabled: false,
  };
}

type NavbarProps = {
  token?: null | undefined | TokenContents;
};
export default function AppBar(props: NavbarProps) {
  const classes = useStyles();
  // const globalState = useContext(store);

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const isAuthenticated = checkToken(props.token);
  const toggle = () => setIsOpen(!isOpen);

  const pouchProjectList = useEventedPromise(
    getProjectList,
    listenProjectList,
    true,
    []
  ).expect();

  const topMenuItems: Array<MenuItemProps> = [
    {
      title: 'Home',
      icon: <HomeIcon />,
      to: ROUTES.INDEX,
      disabled: false,
    },
    {
      title: 'WorkSpace',
      icon: <DashboardIcon />,
      to: ROUTES.WORKSPACE,
      disabled: !isAuthenticated,
    },
    pouchProjectList === null
      ? {
          title: '[loading]',
          icon: <AccountTree />,
          to: '/',
          disabled: true,
        }
      : isAuthenticated
      ? getNestedProjects(pouchProjectList)
      : {
          title: 'Notebooks',
          icon: <AccountTree />,
          to: '/',
          disabled: true,
        },
    {
      title: 'New Notebook',
      icon: <AddIcon />,
      to: ROUTES.PROJECT_CREATE,
      disabled: !SHOW_NEW_NOTEBOOK,
    },
    {
      title: 'About Build',
      icon: <SettingsIcon />,
      to: ROUTES.ABOUT_BUILD,
      disabled: false,
    },
  ];
  const bottomMenuItems: Array<MenuItemProps> = [
    isAuthenticated
      ? {
          title: 'Profile',
          icon: <AccountCircleIcon />,
          to: ROUTES.SIGN_IN,
          disabled: false,
        }
      : {
          title: 'Profile',
          icon: <AccountCircleIcon />,
          to: '/',
          disabled: true,
        },
    isAuthenticated
      ? {
          title: 'Settings',
          icon: <SettingsIcon />,
          to: ROUTES.SIGN_IN,
          disabled: false,
        }
      : {
          title: 'Settings',
          icon: <SettingsIcon />,
          to: ROUTES.SIGN_IN,
          disabled: true,
        },
  ];

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
              size="large"
            >
              <MenuIcon />
            </IconButton>
            <NavLink style={{flexGrow: 1}} to={ROUTES.INDEX}>
              <img
                src="/static/logo/Faims-white-small.png"
                style={{maxWidth: '70px', flex: 1}}
              />
            </NavLink>
            <div>
              {isAuthenticated ? <ConnectedStatus token={props.token} /> : ''}
              {isAuthenticated ? <SyncStatus token={props.token} /> : ''}
              <AppBarAuth token={props.token} />
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
                  <ListItem
                    button
                    onClick={() => {
                      setNestedMenuOpen(prevNestedMenuOpen => ({
                        ...prevNestedMenuOpen,
                        [item.title]: !prevNestedMenuOpen[item.title],
                      }));
                    }}
                    disabled={item.disabled}
                  >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText>{item.title} </ListItemText>
                    {item.nested.length === 0 ? (
                      <CircularProgress size={12} thickness={4} />
                    ) : nestedMenuOpen[item.title] ? (
                      <ExpandLess />
                    ) : (
                      <ExpandMore />
                    )}
                  </ListItem>
                  <Collapse
                    in={nestedMenuOpen[item.title]}
                    timeout="auto"
                    unmountOnExit
                    key={'menuItemCollapse' + item.title}
                  >
                    <List component="div" disablePadding dense={true}>
                      {item.nested.map(
                        (nestedItem: {
                          icon: React.ReactChild;
                          title: string;
                          to: string;
                        }) => (
                          <ListItem
                            button
                            className={classes.nested}
                            key={
                              'nestedMenuItem' + item.title + nestedItem.title
                            }
                            to={nestedItem.to}
                            component={RouterLink}
                            disabled={item.disabled}
                          >
                            <ListItemIcon>{nestedItem.icon}</ListItemIcon>
                            <ListItemText primary={nestedItem.title} />
                          </ListItem>
                        )
                      )}
                    </List>
                  </Collapse>
                </React.Fragment>
              ) : (
                <ListItem
                  button
                  key={item.title}
                  to={item.to}
                  component={RouterLink}
                  disabled={item.disabled}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.title} />
                </ListItem>
              );
            })}
          </List>
          <Divider />
          <List>
            {bottomMenuItems.map(
              (item: {
                title: string;
                icon: React.ReactChild | undefined;
                disabled: boolean;
                to: any;
              }) => (
                <ListItem
                  button
                  key={item.title}
                  disabled={item.disabled}
                  to={item.to}
                  component={RouterLink}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.title} />
                </ListItem>
              )
            )}
          </List>
        </Drawer>
      </div>
      <SystemAlert />
    </React.Fragment>
  );
}
