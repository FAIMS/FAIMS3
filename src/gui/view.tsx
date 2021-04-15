import React from 'react';

type ViewProps = {
  viewList: any;
  form: any; //FAIMSForm; @TODO fix type
  formProps: any;
};

type ViewState = {
  // validationCallbacks: any;
};

export class ViewComponent extends React.Component<ViewProps, ViewState> {
  constructor(props) {
    super(props);
    const form = this.props.form;
  }

  componentDidMount() {}

  save(values) {
    console.log(values);
  }

  getForm() {
    return this.props.form;
  }

  render() {
    const form = this.props.form;
    return (
      <React.Fragment>
        {this.props.viewList.map(fieldName => {
          return form.getComponentFromField(fieldName, this);
        })}
      </React.Fragment>
    );
  }
}
