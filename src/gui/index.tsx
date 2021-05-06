import React from 'react';
import AppNavBar from './appNav';
import ProjectNavTabs from './projectNav';
import {initializeEvents, createdProjects} from '../sync/index';
import {ProjectsList} from '../datamodel';
import {initialize} from '../sync';

type FAIMSContainerProps = {
  // project: string;
};

type FAIMSContainerState = {
  projects: ProjectsList;
  global_error: null | {};
  mounted: boolean;
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
      global_error: null,
      mounted: false,
    };

    for (const active_id in createdProjects) {
      projects[active_id] = createdProjects[active_id].project;
    }

    initializeEvents.on('project_meta_paused', (listing, active, project) => {
      projects[active._id] = project;
      if (this.state.mounted) {
        this.setState(this.state);
      }
    });

    initialize().catch(err => this.setState({global_error: err}));
  }

  componentDidMount() {
    // get view components, render form
    this.setState({mounted: true});
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
