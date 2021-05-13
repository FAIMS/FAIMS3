import React from 'react';

type ProjectsProps = {
  // project: string;
};

type ProjectsState = {};

export class Projects extends React.Component<ProjectsProps, ProjectsState> {
  constructor(props: ProjectsProps) {
    super(props);

    this.state = {};
  }

  render() {
    return <div>Projects</div>;
  }
}
