import React from 'react';
import * as Yup from 'yup';
import {Button, Chip, Grid, Box} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import grey from '@material-ui/core/colors/grey';
import CircularProgress from '@material-ui/core/CircularProgress';
import {getComponentByName} from './ComponentRegistry';
import {getUiSpecForProject} from './dbHelpers';
import {Formik, Form, Field, FormikProps, ErrorMessage} from 'formik';

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
    this.getComponentFromField = this.getComponentFromField.bind(this);
    this.getValidationSchema = this.getValidationSchema.bind(this);
    this.getInitialValues = this.getInitialValues.bind(this);
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
    return this.getComponentFromFieldConfig(fields[fieldName], view, fieldName);
  }

  getComponentFromFieldConfig(
    fieldConfig: any,
    view: ViewComponent,
    fieldName: string
  ) {
    const Component = getComponentByName(
      fieldConfig['component-namespace'],
      fieldConfig['component-name']
    );
    const formProps = view.props.formProps;
    const errors = formProps.errors;
    return (
      <React.Fragment key={fieldName}>
        <Box mb={3}>
          <Field
            component={Component}
            // view={view}
            error={formProps.touched[fieldName] && Boolean(errors[fieldName])}
            {...fieldConfig['component-parameters']}
            {...fieldConfig['component-parameters']['InputProps']}
            {...fieldConfig['component-parameters']['SelectProps']}
            {...fieldConfig['component-parameters']['InputLabelProps']}
            {...fieldConfig['component-parameters']['FormHelperTextProps']}
          />
        </Box>
      </React.Fragment>
    );
  }

  getValidationSchema() {
    const {uiSpec, currentView} = this.state;
    const viewList: Array<string> = uiSpec['views'][currentView]['fields'];
    const fields = uiSpec['fields'];
    const validationSchema = Object();
    viewList.forEach(fieldName => {
      validationSchema[fieldName] = fields[fieldName]['validationSchema'];
    });
    return Yup.object().shape(validationSchema);
  }

  getInitialValues() {
    const {uiSpec, currentView} = this.state;
    const viewList: Array<string> = uiSpec['views'][currentView]['fields'];
    const fields = uiSpec['fields'];
    const initialValues = Object();
    viewList.forEach(fieldName => {
      initialValues[fieldName] = fields[fieldName]['initialValue'];
    });
    return initialValues;
  }

  render() {
    const uiSpec = this.state.uiSpec;
    const viewName = this.state.currentView;
    const viewList: Array<string> = uiSpec['views'][viewName]['fields'];

    return (
      <React.Fragment>
        <Box mt={4} mb={3}>
          <Chip label={this.props.project} /> is the current project
        </Box>
        <Formik
          initialValues={this.getInitialValues()}
          validationSchema={this.getValidationSchema}
          onSubmit={(values, {setSubmitting}) => {
            setTimeout(() => {
              setSubmitting(false);
              console.log(JSON.stringify(values, null, 2));
            }, 500);
          }}
        >
          {formProps => (
            <Form>
              <Grid container spacing={2}>
                <Grid item sm={6} xs={12}>
                  <ViewComponent
                    viewList={viewList}
                    form={this}
                    formProps={formProps}
                  />
                  <br />
                  {formProps.isValid ? (
                    ''
                  ) : (
                    <Alert severity="error">
                      Form has errors, please scroll up and make changes before
                      re-submitting.
                    </Alert>
                  )}
                  <br />
                  <Button
                    type="submit"
                    color={formProps.isSubmitting ? 'default' : 'primary'}
                    variant="contained"
                    onClick={formProps.submitForm}
                    disableElevation
                    disabled={formProps.isSubmitting}
                  >
                    {formProps.isSubmitting ? 'Submitting...' : 'Submit'}
                    {formProps.isSubmitting && (
                      <CircularProgress
                        size={24}
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          marginTop: -12,
                          marginLeft: -12,
                        }}
                      />
                    )}
                  </Button>
                </Grid>
                <Grid item sm={6} xs={12}>
                  <Box bgcolor={grey[200]} p={2}>
                    <pre style={{margin: 0}}>
                      {JSON.stringify(this.props, null, 2)}
                    </pre>
                    <pre>{JSON.stringify(formProps, null, 2)}</pre>
                  </Box>
                </Grid>
              </Grid>
            </Form>
          )}
        </Formik>
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
