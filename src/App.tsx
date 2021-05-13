import React from 'react';
import {BrowserRouter as Router, Route, Switch} from 'react-router-dom';
import './App.css';
import * as ROUTES from './constants/routes';
import NavBar from './gui/components/navbar';
import {Index} from './gui/pages/index';
import {SignUp} from './gui/pages/signup';
import {SignIn} from './gui/pages/signin';
import {ForgotPassword} from './gui/pages/forgot-password';
import Home from './gui/pages/home';
import {Projects} from './gui/pages/projects';

import ProjectNavTabs from './gui/projectNav';

import {MuiThemeProvider, createMuiTheme} from '@material-ui/core/styles';
// import {unstable_createMuiStrictModeTheme as createMuiTheme} from '@material-ui/core';
// https://stackoverflow.com/a/64135466/3562777 temporary solution to remove findDOMNode is depreciated in StrictMode warning
// will be resolved in material-ui v5
import {Shadows} from '@material-ui/core/styles/shadows';
import {createdProjects, initialize, initializeEvents} from './sync';
import {ProjectsList} from './datamodel';

const theme = createMuiTheme({
  palette: {
    primary: {
      main: '#1B3E93',
    },
    secondary: {
      main: '#F68E1E',
    },
  },
  typography: {
    fontFamily: "'Open Sans', sans-serif",
  },
  shadows: Array(25).fill('none') as Shadows,
});

type AppProps = {};

type AppState = {
  projects: ProjectsList;
  global_error: null | {};
};

export class App extends React.Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props);
    const projects: ProjectsList = {};

    this.state = {
      projects: projects,
      global_error: null,
    };

    for (const active_id in createdProjects) {
      projects[active_id] = createdProjects[active_id].project;
    }
  }
  componentDidMount() {
    // get view components, render form
    initializeEvents.on('project_meta_paused', (listing, active, project) => {
      this.state.projects[active._id] = project;
      this.setState({projects: this.state.projects});
    });
    initialize().catch(err => this.setState({global_error: err}));
  }

  render() {
    return (
      <MuiThemeProvider theme={theme}>
        {/*<FAIMSContainer />*/}
        <Router>
          <NavBar projectList={this.state.projects} />
          <Switch>
            <Route exact path={ROUTES.SIGN_UP} component={SignUp} />
            <Route exact path={ROUTES.SIGN_IN} component={SignIn} />
            <Route
              exact
              path={ROUTES.FORGOT_PASSWORD}
              component={ForgotPassword}
            />

            <Route exact path={ROUTES.HOME} component={Home} />
            <Route exact path={ROUTES.PROJECTS} component={Projects} />
            <Route
              exact
              path={ROUTES.DUMMY}
              render={props => (
                <ProjectNavTabs {...props} projectList={this.state.projects} />
              )}
            />
            <Route exact path="/" component={Index} />
          </Switch>
        </Router>
      </MuiThemeProvider>
    );
  }
}

export default App;
