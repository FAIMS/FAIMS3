import React from 'react';

import {getAvailableProjectsMetaData} from './dbHelpers';
import ProjectNavTabs from './projectNav';
import {FAIMSForm} from './form';

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
        <ProjectNavTabs projectList={this.state.projects} />
      </React.Fragment>
    );
  }
}
