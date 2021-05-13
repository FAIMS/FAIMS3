import React from 'react';

type ForgotPasswordProps = {
  // project: string;
};

type ForgotPasswordState = {};

export class ForgotPassword extends React.Component<
  ForgotPasswordProps,
  ForgotPasswordState
> {
  constructor(props: ForgotPasswordProps) {
    super(props);

    this.state = {};
  }

  render() {
    return <div>ForgotPassword</div>;
  }
}
