import React from 'react';
import {getAvailableProjectsMetaData, ProjectsList} from './dbHelpers';
import AppNavBar from './appNav';
import ProjectNavTabs from './projectNav';
import {initializeEvents, projects_dbs} from '../sync';

type FAIMSContainerProps = {
  // project: string;
};

type FAIMSContainerState = {
  projects: ProjectsList;
};

export class FAIMSContainer extends React.Component<
  FAIMSContainerProps,
  FAIMSContainerState
> {
  constructor(props) {
    super(props);
    const projects: ProjectsList = {};

    this.state = {
      projects: projects,
    };

    initializeEvents.on(
      'project_processing',
      (listing, project, active, meta, data) => {
        projects[active._id] = project;
      }
    );
  }

  componentDidMount() {
    // get view components, render form
  }

  render() {
    return (
      <React.Fragment>
        <AppNavBar />
        <ProjectNavTabs projectList={this.state.projects} />
      </React.Fragment>
    );
  }
}
