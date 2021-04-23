import React from 'react';
import {Button, Grid, Box} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import grey from '@material-ui/core/colors/grey';
import CircularProgress from '@material-ui/core/CircularProgress';
import {getComponentByName} from './ComponentRegistry';
import {getUiSpecForProject} from '../uiSpecification';
import {Formik, Form, Field, FormikProps} from 'formik';
import {transformAll} from '@demvsystems/yup-ast';
import {ViewComponent} from './view';
import {upsertFAIMSData, lookupFAIMSDataID} from '../dataStorage';
import {ProjectUIModel} from '../datamodel';

type FormProps = {
  activeProjectID: string;
  uiSpec: ProjectUIModel;
};

type FormState = {
  currentView: string;
};

export class FAIMSForm extends React.Component<FormProps, FormState> {
  constructor(props) {
    super(props);
    this.state = {
      currentView: props.uiSpec['start_view'],
    };
    this.getComponentFromField = this.getComponentFromField.bind(this);
    this.getValidationSchema = this.getValidationSchema.bind(this);
    this.getInitialValues = this.getInitialValues.bind(this);
  }

  componentDidMount() {
    // get view components, render form
  }

  save(values) {
    console.log(values);
    upsertFAIMSData(this.props.activeProjectID, values);
  }

  updateView(viewName) {
    if (viewName in this.props.uiSpec['views']) {
      this.setState({currentView: viewName});
      this.forceUpdate();
      // Probably not needed, but we *know* we need to rerender when this
      // changes, so let's be explicit.
    } else {
      throw Error(`No view ${viewName}`);
    }
  }

  getComponentFromField(fieldName: string, view: ViewComponent) {
    // console.log('getComponentFromField');
    const uiSpec = this.props.uiSpec;
    const fields = uiSpec['fields'];
    return this.getComponentFromFieldConfig(fields[fieldName], view, fieldName);
  }

  getComponentFromFieldConfig(
    fieldConfig: any,
    view: ViewComponent,
    fieldName: string
  ) {
    // console.log('getComponentFromFieldConfig');
    const Component = getComponentByName(
      fieldConfig['component-namespace'],
      fieldConfig['component-name']
    );
    const formProps = view.props.formProps;
    const errors = formProps.errors;
    return (
      <Box mb={3} key={fieldName}>
        <Field
          component={Component} //e.g, TextField (default <input/>)
          name={fieldName}
          onChange={formProps.handleChange}
          onBlur={formProps.handleBlur}
          value={formProps.values[fieldName]}
          // view={view}
          error={formProps.touched[fieldName] && Boolean(errors[fieldName])}
          {...fieldConfig['component-parameters']}
          {...fieldConfig['component-parameters']['InputProps']}
          {...fieldConfig['component-parameters']['SelectProps']}
          {...fieldConfig['component-parameters']['InputLabelProps']}
          {...fieldConfig['component-parameters']['FormHelperTextProps']}
        />
      </Box>
    );
  }

  getValidationSchema() {
    // console.log('getValidationSchema');
    const {currentView} = this.state;
    const uiSpec = this.props.uiSpec;
    const viewList: Array<string> = uiSpec['views'][currentView]['fields'];
    const fields = uiSpec['fields'];
    const validationSchema = Object();
    viewList.forEach(fieldName => {
      validationSchema[fieldName] = fields[fieldName]['validationSchema'];
    });
    return transformAll([['yup.object'], ['yup.shape', validationSchema]]);
  }

  getInitialValues() {
    // console.log('getInitialValues');
    const {currentView} = this.state;
    const uiSpec = this.props.uiSpec;
    const viewList: Array<string> = uiSpec['views'][currentView]['fields'];
    const fields = uiSpec['fields'];
    const initialValues = Object();
    viewList.forEach(fieldName => {
      initialValues[fieldName] = fields[fieldName]['initialValue'];
    });
    return initialValues;
  }

  render() {
    const {currentView} = this.state;
    const uiSpec = this.props.uiSpec;
    const viewList: Array<string> = uiSpec['views'][currentView]['fields'];

    return (
      <React.Fragment>
        <Formik
          initialValues={this.getInitialValues()}
          validationSchema={this.getValidationSchema}
          validateOnMount={true}
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
                  <Box bgcolor={grey[200]} p={2} style={{overflowX: 'scroll'}}>
                    <pre>{JSON.stringify(formProps, null, 2)}</pre>
                  </Box>
                </Grid>
              </Grid>
            </Form>
          )}
        </Formik>
      </React.Fragment>
    );
  }
}
