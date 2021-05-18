import React from 'react';

type SignUpProps = {
  // project: string;
};

type SignUpState = {};

export class SignUp extends React.Component<SignUpProps, SignUpState> {
  constructor(props: SignUpProps) {
    super(props);

    this.state = {};
  }

  render() {
    return <div>SignUp</div>;
  }
}
