import React from 'react';
import AppNavBar from './appNav';
import ProjectNavTabs from './projectNav';
import {initializeEvents, createdProjects} from '../sync/index';
import {ProjectsList} from '../datamodel';

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
  constructor(props: FAIMSContainerProps) {
    super(props);
    const projects: ProjectsList = {};

    this.state = {
      projects: projects,
    };

    for (const active_id in createdProjects) {
      projects[active_id] = createdProjects[active_id].project;
    }

    /* eslint-disable @typescript-eslint/no-unused-vars */
    initializeEvents.on(
      'project_syncing',
      (listing, project, active, meta, data) => {
        projects[active._id] = project;
      }
    );
    /* eslint-enable @typescript-eslint/no-unused-vars */
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
