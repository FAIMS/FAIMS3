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

import React, {useEffect, useState} from 'react';
import {Link as RouterLink} from 'react-router-dom';
import {
  AppBar as MuiAppBar,
  CircularProgress,
  IconButton,
  Toolbar,
  ListItemButton,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CssBaseline from '@mui/material/CssBaseline';
import clsx from 'clsx';
import Collapse from '@mui/material/Collapse';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
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
import {getActiveProjectList} from '../../sync/projects';
import SystemAlert from '../components/alert';
import {ProjectInformation} from '@faims3/data-model';
import AppBarAuth from '../components/authentication/appbarAuth';
import {TokenContents} from '@faims3/data-model';
import {checkToken} from '../../utils/helpers';
import SyncStatus from '../components/sync';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '../../buildconfig';
import {appBarStyling} from '../themes';
import {AppBarHeading} from '../components/app-bar/app-bar-heading';

type ProjectListItemProps = {
  title: string;
  icon: any;
  to: string;
  disabled: boolean;
};
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

function getNestedProjects(pouchProjectList: ProjectInformation[]) {
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

type NavbarProps = {
  token?: null | undefined | TokenContents;
};
export default function MainAppBar(props: NavbarProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const isAuthenticated = checkToken(props.token);
  const toggle = () => setIsOpen(!isOpen);

  const [projectList, setProjectList] = useState<ProjectInformation[]>([]);

  useEffect(() => {
    getActiveProjectList().then(projects => setProjectList(projects));
  }, []);

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

  const classes = appBarStyling();

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
              <MenuIcon className={classes.menuIcon} />
            </IconButton>
            <AppBarHeading link={ROUTES.INDEX} />
            <div>
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
