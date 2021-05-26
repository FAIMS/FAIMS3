import React from 'react';
import {BrowserRouter as Router, Route, Switch} from 'react-router-dom';
import './App.css';
import * as ROUTES from './constants/routes';
import NavBar from './gui/components/navbar';
import Footer from './gui/components/footer';
import {Index} from './gui/pages';
import {SignUp} from './gui/pages/signup';
import {SignIn} from './gui/pages/signin';
import {ForgotPassword} from './gui/pages/forgot-password';
import Home from './gui/pages/home';
import ProjectList from './gui/pages/project-list';
import Project from './gui/pages/project';
import ObservationList from './gui/pages/observation-list';
import Observation from './gui/pages/observation';
import ObservationCreate from './gui/pages/observation-create';
import NotFound404 from './gui/pages/404';
import ProjectNavTabs from './gui/projectNav';
import {StateProvider} from './store';

import {MuiThemeProvider} from '@material-ui/core/styles';

// import {unstable_createMuiStrictModeTheme as createMuiTheme} from '@material-ui/core';
// https://stackoverflow.com/a/64135466/3562777 temporary solution to remove findDOMNode is depreciated in StrictMode warning
// will be resolved in material-ui v5

import {createdProjects} from './sync';
import {ProjectsList} from './datamodel';
import theme from './gui/theme';

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
              <Route
                exact
                path={ROUTES.OBSERVATION_LIST}
                component={ObservationList}
              />
              <Route exact path={ROUTES.PROJECT_LIST} component={ProjectList} />
              <Route
                exact
                path={ROUTES.PROJECT + ':listing_id_project_id'}
                component={Project}
              />
              <Route
                exact
                path={
                  ROUTES.PROJECT +
                  ':listing_id_project_id' +
                  ROUTES.OBSERVATION +
                  ':observation_id'
                }
                component={Observation}
              />
              <Route
                exact
                path={
                  ROUTES.PROJECT +
                  ':listing_id_project_id' +
                  ROUTES.OBSERVATION_CREATE
                }
                component={ObservationCreate}
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
              <Route component={NotFound404} />
            </Switch>
            <Footer />
          </Router>
        </MuiThemeProvider>
      </StateProvider>
    );
  }
}

export default App;
