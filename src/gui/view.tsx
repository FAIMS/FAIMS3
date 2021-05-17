import {FormikProps} from 'formik';
import React from 'react';

type ViewProps = {
  viewList: Array<string>;
  form: any; //FAIMSForm; @TODO fix type
  formProps: FormikProps<{[key: string]: unknown}>;
};

type ViewState = {
  // validationCallbacks: any;
};

export class ViewComponent extends React.Component<ViewProps, ViewState> {
  constructor(props: ViewProps) {
    super(props);
  }

  componentDidMount() {}

  save(values: any) {
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
