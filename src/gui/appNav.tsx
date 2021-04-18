import React from 'react';
import {
  Typography,
  Button,
  AppBar,
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

interface NavbarProps extends WithStyles<typeof styles> {
  classes: any;
}

type NavbarState = {};

const styles = (theme: Theme) =>
  createStyles({
    root: {
      flexGrow: 1,
    },
    menuButton: {
      marginRight: theme.spacing(2),
    },
    title: {
      flexGrow: 1,
    },
  });

class AppNavBar extends React.Component<NavbarProps, NavbarState> {
  render() {
    const {classes} = this.props;

    return (
      <React.Fragment>
        <AppBar position="static">
          <Toolbar>
            <IconButton
              edge="start"
              className={classes.menuButton}
              color="inherit"
              aria-label="menu"
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" className={classes.title}>
              FAIMS3
            </Typography>
            <Button color="inherit">Login</Button>
          </Toolbar>
        </AppBar>
      </React.Fragment>
    );
  }
}
export default withStyles(styles)(AppNavBar);
