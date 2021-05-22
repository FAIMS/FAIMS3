import React from 'react';
import {BrowserRouter as Router, Route, Switch} from 'react-router-dom';
import './App.css';
import * as ROUTES from './constants/routes';
import NavBar from './gui/components/navbar';
import {Index} from './gui/pages';
import {SignUp} from './gui/pages/signup';
import {SignIn} from './gui/pages/signin';
import {ForgotPassword} from './gui/pages/forgot-password';
import Home from './gui/pages/home';
import ProjectList from './gui/pages/project-list';
import Project from './gui/pages/project';
import {StateProvider} from './store';

import ProjectNavTabs from './gui/projectNav';

import {MuiThemeProvider, createMuiTheme} from '@material-ui/core/styles';
// import {unstable_createMuiStrictModeTheme as createMuiTheme} from '@material-ui/core';
// https://stackoverflow.com/a/64135466/3562777 temporary solution to remove findDOMNode is depreciated in StrictMode warning
// will be resolved in material-ui v5
import {Shadows} from '@material-ui/core/styles/shadows';
import {createdProjects} from './sync';
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

  render() {
    return (
      <StateProvider>
        <MuiThemeProvider theme={theme}>
          <Router>
            <NavBar />
            <Switch>
              <Route exact path={ROUTES.SIGN_UP} component={SignUp} />
              <Route exact path={ROUTES.SIGN_IN} component={SignIn} />
              <Route
                exact
                path={ROUTES.FORGOT_PASSWORD}
                component={ForgotPassword}
              />

              <Route exact path={ROUTES.HOME} component={Home} />
              <Route exact path={ROUTES.PROJECT_LIST} component={ProjectList} />
              <Route
                exact
                path={ROUTES.PROJECT + ':project_id'}
                component={Project}
              />
              <Route
                exact
                path={ROUTES.DUMMY}
                render={props => (
                  <ProjectNavTabs
                    {...props}
                    projectList={this.state.projects}
                  />
                )}
              />
              <Route exact path="/" component={Index} />
            </Switch>
          </Router>
        </MuiThemeProvider>
      </StateProvider>
    );
  }
}

export default App;
