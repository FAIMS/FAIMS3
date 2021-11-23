/*
 * Copyright 2021 Macquarie University
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
 *   TODO
 */

import React, {useState} from 'react';
import {Link as RouterLink} from 'react-router-dom';
import {
  AppBar as MuiAppBar,
  CircularProgress,
  IconButton,
  Toolbar,
} from '@material-ui/core';
import MenuIcon from '@material-ui/icons/Menu';
import {makeStyles} from '@material-ui/core/styles';
import CssBaseline from '@material-ui/core/CssBaseline';
import clsx from 'clsx';
import Collapse from '@material-ui/core/Collapse';
import Drawer from '@material-ui/core/Drawer';
import Divider from '@material-ui/core/Divider';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
// import BuildIcon from '@material-ui/icons/Build';
import AddIcon from '@material-ui/icons/Add';
import HomeIcon from '@material-ui/icons/Home';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import DescriptionIcon from '@material-ui/icons/Description';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import AccountCircleIcon from '@material-ui/icons/AccountCircle';
import SettingsIcon from '@material-ui/icons/Settings';
// import MessageIcon from '@material-ui/icons/Message';
import NotificationsIcon from '@material-ui/icons/Notifications';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';
import AccountTree from '@material-ui/icons/AccountTree';
import ListItemText from '@material-ui/core/ListItemText';
import * as ROUTES from '../../constants/routes';
import {getProjectList} from '../../databaseAccess';
import SystemAlert from './alert';
import {ProjectInformation} from '../../datamodel/ui';

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
  },
  appBar: {
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
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

export default function Navbar() {
  const classes = useStyles();
  // const globalState = useContext(store);

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const isSyncing = false;
  // const [isSyncing, setIsSyncing] = useState<boolean>(false);
  // const [projectList, setProjectList] = useState<ProjectsList>({});
  // const [error, setError] = useState<string | null>(null);
  const toggle = () => setIsOpen(!isOpen);

  const pouchProjectList = getProjectList();

  const topMenuItems: Array<MenuItemProps> = [
    {
      title: 'Home',
      icon: <HomeIcon />,
      to: ROUTES.HOME,
      disabled: false,
    },
    getNestedProjects(pouchProjectList),
    {
      title: 'New Notebook',
      icon: <AddIcon />,
      to: ROUTES.PROJECT_CREATE,
      disabled: false,
    },
    // {
    //   title: 'Tools',
    //   icon: <BuildIcon />,
    //   to: '/',
    //   disabled: true,
    // },
    {
      title: 'Notifications',
      icon: <NotificationsIcon />,
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
  const bottomMenuItems: Array<MenuItemProps> = [
    {
      title: 'Profile',
      icon: <AccountCircleIcon />,
      to: '/',
      disabled: true,
    },
    // {
    //   title: 'Messages',
    //   icon: <MessageIcon />,
    //   to: '/',
    //   disabled: true,
    // },
    {
      title: 'Settings',
      icon: <SettingsIcon />,
      to: '/',
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
            >
              <MenuIcon />
            </IconButton>
            <img
              src="/static/logo/Faims-white-small.png"
              style={{maxWidth: '70px', flex: 1}}
            />
            {isSyncing ? (
              <CircularProgress
                color={'secondary'}
                size={'1rem'}
                thickness={5}
              />
            ) : (
              ''
            )}
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
            <IconButton onClick={toggle}>
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
              }) => (
                <ListItem button key={item.title} disabled={item.disabled}>
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
