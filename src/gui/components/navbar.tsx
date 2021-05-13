import React from 'react';
import {
  Typography,
  AppBar as MuiAppBar,
  Toolbar,
  IconButton,
} from '@material-ui/core';
import MenuIcon from '@material-ui/icons/Menu';
import {
  createStyles,
  withStyles,
  WithStyles,
  Theme,
} from '@material-ui/core/styles';
import CssBaseline from '@material-ui/core/CssBaseline';
import clsx from 'clsx';
import {CircularProgress} from '@material-ui/core';
import Collapse from '@material-ui/core/Collapse';
import Drawer from '@material-ui/core/Drawer';
import Divider from '@material-ui/core/Divider';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import BuildIcon from '@material-ui/icons/Build';
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

import {ProjectsList} from '../../datamodel';

interface NavBarProps extends WithStyles<typeof styles> {
  classes: any;
  projectList: ProjectsList;
}

type NavBarState = {
  topMenuItems: any;
  bottomMenuItems: any;
  open: boolean;
  nestedMenuOpen: any;
};

type ProjectListItemProps = {
  title: string;
  icon: any;
};
const drawerWidth = 240;

const styles = (theme: Theme) =>
  createStyles({
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
  });

class NavBar extends React.Component<NavBarProps, NavBarState> {
  constructor(props: NavBarProps) {
    super(props);

    const projectMenuItem = this.getProjectsFromProps();
    this.state = {
      topMenuItems: [
        projectMenuItem,
        {
          title: 'Tools',
          icon: <BuildIcon />,
        },
        {
          title: 'Notifications',
          icon: <NotificationsIcon />,
        },
      ],
      bottomMenuItems: [
        {
          title: 'Profile',
          icon: <AccountCircleIcon />,
        },
        {
          title: 'Messages',
          icon: <MessageIcon />,
        },
        {
          title: 'Settings',
          icon: <SettingsIcon />,
        },
      ],
      open: false,
      nestedMenuOpen: {
        Projects: false,
      },
    };

    this.handleDrawerOpen = this.handleDrawerOpen.bind(this);
    this.handleDrawerClose = this.handleDrawerClose.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.getProjectsFromProps = this.getProjectsFromProps.bind(this);
  }
  handleDrawerOpen() {
    this.setState({open: true});
  }
  handleDrawerClose() {
    this.setState({open: false});
  }
  handleClick(menuName: string) {
    const nestedMenuOpen = this.state.nestedMenuOpen;
    nestedMenuOpen[menuName] = !nestedMenuOpen[menuName];
    this.setState({nestedMenuOpen: nestedMenuOpen});
  }

  getProjectsFromProps() {
    const projectList: ProjectListItemProps[] = [];
    Object.keys(this.props.projectList).map(key => {
      projectList.push({
        title: this.props.projectList[key].name,
        icon: <DescriptionIcon />,
      });
    });
    return {
      title: 'Projects',
      icon: <AccountTree />,
      nested: projectList,
      open: false,
    };
  }

  render() {
    const {classes} = this.props;
    const {open, nestedMenuOpen, topMenuItems, bottomMenuItems} = this.state;

    return (
      <React.Fragment>
        <div className={classes.root}>
          <CssBaseline />
          <MuiAppBar
            position="relative"
            className={clsx(classes.appBar, {
              [classes.appBarShift]: this.state.open,
            })}
          >
            <Toolbar>
              <IconButton
                color="inherit"
                aria-label="open drawer"
                onClick={this.handleDrawerOpen}
                edge="start"
                className={clsx(classes.menuButton, open && classes.hide)}
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
            variant="persistent"
            anchor="left"
            open={this.state.open}
            classes={{
              paper: classes.drawerPaper,
            }}
          >
            <div className={classes.drawerHeader}>
              <IconButton onClick={this.handleDrawerClose}>
                <ChevronLeftIcon />
              </IconButton>
            </div>
            <Divider />

            <List>
              {topMenuItems.map(
                (item: {
                  nested: any;
                  title: string;
                  icon: React.ReactChild | undefined;
                }) => {
                  return Object.prototype.hasOwnProperty.call(
                    item,
                    'nested'
                  ) ? (
                    <>
                      <ListItem
                        button
                        onClick={() => {
                          this.handleClick(item.title);
                        }}
                        key={'menuItem' + item.title}
                      >
                        <ListItemIcon>{item.icon}</ListItemIcon>
                        <ListItemText>
                          {item.title}{' '}
                          {item.nested.length === 0 ? (
                            <CircularProgress size={12} thickness={4} />
                          ) : (
                            ''
                          )}
                        </ListItemText>
                        {nestedMenuOpen[item.title] ? (
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
                            }) => (
                              <ListItem
                                button
                                className={classes.nested}
                                key={
                                  'nestedMenuItem' +
                                  item.title +
                                  nestedItem.title
                                }
                              >
                                <ListItemIcon>{nestedItem.icon}</ListItemIcon>
                                <ListItemText primary={nestedItem.title} />
                              </ListItem>
                            )
                          )}
                        </List>
                      </Collapse>
                    </>
                  ) : (
                    <ListItem button key={item.title}>
                      <ListItemIcon>{item.icon}</ListItemIcon>
                      <ListItemText primary={item.title} />
                    </ListItem>
                  );
                }
              )}
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
          {/*<main*/}
          {/*  className={clsx(classes.content, {*/}
          {/*    [classes.contentShift]: this.state.open,*/}
          {/*  })}*/}
          {/*>*/}
          {/*  <div className={classes.drawerHeader} />*/}
          {/*</main>*/}
        </div>
      </React.Fragment>
    );
  }
}
export default withStyles(styles)(NavBar);
