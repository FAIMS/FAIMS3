import React from 'react';

type SignInProps = {
  // project: string;
};

type SignInState = {};

export class SignIn extends React.Component<SignInProps, SignInState> {
  constructor(props: SignInProps) {
    super(props);

    this.state = {};
  }

  render() {
    return <div>SignIn</div>;
  }
}
