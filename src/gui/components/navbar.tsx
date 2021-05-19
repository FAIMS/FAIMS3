import React, {useContext, useEffect, useState} from 'react';
import {Link as RouterLink} from 'react-router-dom';
import {
  AppBar as MuiAppBar,
  CircularProgress,
  IconButton,
  Toolbar,
  Typography,
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
import BuildIcon from '@material-ui/icons/Build';
import HomeIcon from '@material-ui/icons/Home';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import DescriptionIcon from '@material-ui/icons/Description';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import AccountCircleIcon from '@material-ui/icons/AccountCircle';
import SettingsIcon from '@material-ui/icons/Settings';
import MessageIcon from '@material-ui/icons/Message';
import NotificationsIcon from '@material-ui/icons/Notifications';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';
import AccountTree from '@material-ui/icons/AccountTree';
import ListItemText from '@material-ui/core/ListItemText';
import * as ROUTES from '../../constants/routes';
import {ProjectsList} from '../../datamodel';
import {ActionType} from '../../actions';

import {store} from '../../store';

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
};
type MenuItemProps = {
  nested?: any;
  title: string;
  to: string;
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

function getNestedProjects(projectList: ProjectsList) {
  const projectListItems: ProjectListItemProps[] = [];
  Object.keys(projectList).map(key => {
    projectListItems.push({
      title: projectList[key].name,
      icon: <DescriptionIcon />,
      to: ROUTES.PROJECT + projectList[key]._id,
    });
  });
  return {
    title: 'Projects',
    icon: <AccountTree />,
    nested: projectListItems,
    to: ROUTES.PROJECT_LIST,
  };
}

export default function NavbarNew() {
  const classes = useStyles();
  const globalState = useContext(store);
  const {dispatch} = globalState;

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const toggle = () => setIsOpen(!isOpen);

  const topMenuItems: Array<MenuItemProps> = [
    {
      title: 'Home',
      icon: <HomeIcon />,
      to: ROUTES.HOME,
    },
    getNestedProjects(globalState.state.project_list),
    {
      title: 'Tools',
      icon: <BuildIcon />,
      to: '/',
    },
    {
      title: 'Notifications',
      icon: <NotificationsIcon />,
      to: '/',
    },
  ];
  const bottomMenuItems: Array<MenuItemProps> = [
    {
      title: 'Profile',
      icon: <AccountCircleIcon />,
      to: '/',
    },
    {
      title: 'Messages',
      icon: <MessageIcon />,
      to: '/',
    },
    {
      title: 'Settings',
      icon: <SettingsIcon />,
      to: '/',
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
            <Typography variant="h6" noWrap style={{flex: 1}}>
              FAIMS3
            </Typography>
            <Typography>username</Typography>
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
              (item: {title: string; icon: React.ReactChild | undefined}) => (
                <ListItem button key={item.title}>
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.title} />
                </ListItem>
              )
            )}
          </List>
        </Drawer>
      </div>
    </React.Fragment>
  );
}
