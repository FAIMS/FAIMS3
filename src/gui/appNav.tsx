import React from 'react';
import {Typography, AppBar, Toolbar, IconButton} from '@material-ui/core';
import MenuIcon from '@material-ui/icons/Menu';
import {
  createStyles,
  withStyles,
  WithStyles,
  Theme,
} from '@material-ui/core/styles';
import CssBaseline from '@material-ui/core/CssBaseline';
import clsx from 'clsx';
import Drawer from '@material-ui/core/Drawer';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import Divider from '@material-ui/core/Divider';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import BuildIcon from '@material-ui/icons/Build';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import AccountCircleIcon from '@material-ui/icons/AccountCircle';
import SettingsIcon from '@material-ui/icons/Settings';
import MessageIcon from '@material-ui/icons/Message';
import NotificationsIcon from '@material-ui/icons/Notifications';
import AccountTree from '@material-ui/icons/AccountTree';
import ListItemText from '@material-ui/core/ListItemText';

interface AppBarProps extends WithStyles<typeof styles> {
  classes: any;
}

type AppBarState = {
  open: boolean;
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
  });

class AppNavBar extends React.Component<AppBarProps, AppBarState> {
  constructor(props: AppBarProps) {
    super(props);
    this.state = {
      open: false,
    };
    this.handleDrawerOpen = this.handleDrawerOpen.bind(this);
    this.handleDrawerClose = this.handleDrawerClose.bind(this);
  }
  handleDrawerOpen() {
    this.setState({open: true});
  }
  handleDrawerClose() {
    this.setState({open: false});
  }

  render() {
    const {classes} = this.props;
    const {open} = this.state;
    const topMenuItems = [
      {
        title: 'Projects',
        icon: <AccountTree />,
      },
      {
        title: 'Tools',
        icon: <BuildIcon />,
      },
      {
        title: 'Notifications',
        icon: <NotificationsIcon />,
      },
    ];
    const bottomMenuItems = [
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
    ];
    return (
      <React.Fragment>
        <div className={classes.root}>
          <CssBaseline />
          <AppBar
            position="fixed"
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
          </AppBar>
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
              {topMenuItems.map(item => (
                <ListItem button key={item.title}>
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.title} />
                </ListItem>
              ))}
            </List>
            <Divider />
            <List>
              {bottomMenuItems.map(item => (
                <ListItem button key={item.title}>
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.title} />
                </ListItem>
              ))}
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
export default withStyles(styles)(AppNavBar);
