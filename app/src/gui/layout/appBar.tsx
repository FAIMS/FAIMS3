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
  createTheme,
  ListItemButton,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import {createUseStyles as makeStyles} from 'react-jss';
import CssBaseline from '@mui/material/CssBaseline';
import clsx from 'clsx';
import Collapse from '@mui/material/Collapse';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
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
import {getActiveProjectList, listenProjectList} from '../../databaseAccess';
import SystemAlert from '../components/alert';
import {ProjectInformation} from 'faims3-datamodel';
import {useEventedPromise} from '../pouchHook';
import AppBarAuth from '../components/authentication/appbarAuth';
import {TokenContents} from 'faims3-datamodel';
import {checkToken} from '../../utils/helpers';
// import ConnectedStatus from '../components/authentication/connectedStatus';
import SyncStatus from '../components/sync';

type ProjectListItemProps = {
  title: string;
  icon: any;
  to: string;
  disabled: boolean;
};
// in place of deprecated React.ReactChild
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
});

function getNestedProjects(pouchProjectList: ProjectInformation[]) {
  const projectListItems: ProjectListItemProps[] = [];
  pouchProjectList.map(project_info => {
    projectListItems.push({
      title: project_info.name,
      icon: <DescriptionIcon />,
      to: ROUTES.NOTEBOOK + project_info.project_id,
      disabled: false,
    });
  });
  return {
    title: 'Notebooks',
    icon: <AccountTree />,
    nested: projectListItems,
    to: ROUTES.NOTEBOOK_LIST,
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
    'AppBar component',
    getActiveProjectList,
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
          title: 'Loading notebooks...',
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
  ];
  const bottomMenuItems: Array<MenuItemProps> = [
    isAuthenticated
      ? {
          title: 'User',
          icon: <AccountCircleIcon />,
          to: ROUTES.SIGN_IN,
          disabled: false,
        }
      : {
          title: 'User',
          icon: <AccountCircleIcon />,
          to: '/',
          disabled: true,
        },
    {
      title: 'About Build',
      icon: <SettingsIcon />,
      to: ROUTES.ABOUT_BUILD,
      disabled: false,
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
                src="/static/logo/Fieldmark-Short-Green-NoBorder.png"
                style={{maxWidth: '140px', flex: 1}}
              />
            </NavLink>
            <div>
              {/*{isAuthenticated ? <ConnectedStatus token={props.token} /> : ''}*/}
              {isAuthenticated ? <SyncStatus /> : ''}
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
                    <ListItemText>{item.title} </ListItemText>
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
                            <ListItemText primary={nestedItem.title} />
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
                  <ListItemText primary={item.title} />
                </ListItemButton>
              );
            })}
          </List>
          <Divider />
          <List>
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
                  <ListItemText primary={item.title} />
                </ListItemButton>
              )
            )}
          </List>
        </Drawer>
      </div>
      <SystemAlert />
    </React.Fragment>
  );
}
