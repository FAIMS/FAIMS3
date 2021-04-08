import React from 'react';
import Input from '@material-ui/core/Input';
import {Button, Chip} from '@material-ui/core';
import Box from '@material-ui/core/Box';
import {getComponentByName} from './ComponentRegistry';
import {getUiSpecForProject} from './dbHelpers';
import {Formik, Form} from 'formik';

type FormProps = {
  project: string;
};

type FormState = {
  uiSpec: any;
  currentView: string;
};

export class FAIMSForm extends React.Component<FormProps, FormState> {
  constructor(props) {
    super(props);
    const uiSpec = getUiSpecForProject(props.project);
    this.state = {
      uiSpec: uiSpec,
      currentView: uiSpec['start-view'],
    };
  }

  save(values) {
    console.log(values);
  }

  updateView(viewName) {
    if (viewName in this.state.uiSpec['views']) {
      this.setState({currentView: viewName});
      this.forceUpdate();
      // Probably not needed, but we *know* we need to rerender when this
      // changes, so let's be explicit.
    } else {
      throw Error(`No view ${viewName}`);
    }
  }

  getComponentFromField(fieldName: string, view: ViewComponent) {
    const uiSpec = this.state.uiSpec;
    const fields = uiSpec['fields'];
    return this.getComponentFromFieldConfig(fields[fieldName], view);
  }

  getComponentFromFieldConfig(fieldConfig: any, view: ViewComponent) {
    const Component = getComponentByName(
      fieldConfig['component-namespace'],
      fieldConfig['component-name']
    );
    return <Component view={view} {...fieldConfig['component-parameters']} />;
  }

  render() {
    const uiSpec = this.state.uiSpec;
    const viewName = this.state.currentView;
    const viewList: Array<string> = uiSpec['views'][viewName]['fields'];

    return (
      <React.Fragment>
        <Box m={2} pt={3}>
        <Chip label={this.props.project} /> is the current project
        </Box>
        <Formik
          initialValues={{}}
          onSubmit={(values, {setSubmitting}) => {
            setTimeout(() => {
              setSubmitting(false);
              alert(JSON.stringify(values, null, 2));
            }, 500);
          }}
        >
          {({submitForm, isSubmitting}) => (
            <Form>
              <ViewComponent viewList={viewList} form={this} />
              <Button
                variant="contained"
                color="primary"
                disabled={isSubmitting}
                onClick={submitForm}
              >
                Submit
              </Button>
            </Form>
          )}
        </Formik>
        <hr />
        <hr />
        {/*<form onSubmit={this.validate}>*/}
        {/*  <ViewComponent viewList={viewList} form={this} />*/}
        {/*  <Input type="submit" value="Save" />*/}
        {/*</form>*/}
      </React.Fragment>
    );
  }
}

type ViewProps = {
  viewList: any;
  form: FAIMSForm;
};

type ViewState = {
  // validationCallbacks: any;
};

export class ViewComponent extends React.Component<ViewProps, ViewState> {
  constructor(props) {
    super(props);
    const form = this.props.form;
  }

  save(values) {
    console.log(values);
  }

  getForm() {
    return this.props.form;
  }

  render() {
    const form = this.props.form;
    return (
      <>
        {this.props.viewList.map(fieldName => {
          return form.getComponentFromField(fieldName, this);
        })}
      </>
    );
  }
}
