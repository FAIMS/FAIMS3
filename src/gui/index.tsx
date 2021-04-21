import React from 'react';
import {getAvailableProjectsMetaData} from './dbHelpers';
import AppNavBar from './appNav';
import ProjectNavTabs from './projectNav';

type FAIMSContainerProps = {
  // project: string;
};

type FAIMSContainerState = {
  projects: any;
};

export class FAIMSContainer extends React.Component<
  FAIMSContainerProps,
  FAIMSContainerState
> {
  constructor(props) {
    super(props);
    const projects = getAvailableProjectsMetaData('dummyuser');
    this.state = {
      projects: projects,
    };
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
