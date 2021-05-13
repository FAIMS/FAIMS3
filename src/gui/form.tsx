import React from 'react';
import {Button, Grid, Box} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import grey from '@material-ui/core/colors/grey';
import CircularProgress from '@material-ui/core/CircularProgress';
import {getComponentByName} from './ComponentRegistry';
import {getUiSpecForProject} from '../uiSpecification';
import {Formik, Form, Field} from 'formik';
import {transformAll} from '@demvsystems/yup-ast';
import {ViewComponent} from './view';
import {upsertFAIMSData, generateFAIMSDataID} from '../dataStorage';
import {ProjectUIModel} from '../datamodel';

type FormProps = {
  activeProjectID: string;
  uiSpec: ProjectUIModel;
  obsid?: string;
};

type FormState = {
  currentView: string | null;
  obsid: string;
};

export class FAIMSForm extends React.Component<FormProps, FormState> {
  constructor(props: FormProps) {
    super(props);
    let obsid = props.obsid;
    if (obsid === undefined) {
      obsid = generateFAIMSDataID();
    }
    this.state = {
      currentView: props.uiSpec['start_view'],
      obsid: obsid,
    };
    this.getComponentFromField = this.getComponentFromField.bind(this);
    this.getValidationSchema = this.getValidationSchema.bind(this);
    this.getInitialValues = this.getInitialValues.bind(this);
    this.setState = this.setState.bind(this);
    this.getViewList = this.getViewList.bind(this);
    this.getFields = this.getFields.bind(this);
  }

  async componentDidMount() {
    await this.setUISpec();
  }

  async setUISpec() {
    const uiSpec = await getUiSpecForProject(this.props.activeProjectID);
    this.setState({
      currentView: uiSpec['start_view'],
    });
  }

  save(values: any) {
    const doc = {
      _id: this.state.obsid,
      type: '??:??',
      data: values,
    };
    console.log(doc);
    upsertFAIMSData(this.props.activeProjectID, doc);
  }

  updateView(viewName: string) {
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
    const namespace = fieldConfig['component-namespace'];
    const name = fieldConfig['component-name'];
    let Component;
    try {
      Component = getComponentByName(namespace, name);
    } catch (err) {
      console.debug(err);
      console.warn(`Failed to load component ${namespace}::${name}`);
      return undefined;
    }
    const formProps = view.props.formProps;
    return (
      <Box mb={3} key={fieldName}>
        <Field
          component={Component} //e.g, TextField (default <input/>)
          name={fieldName}
          onChange={formProps.handleChange}
          onBlur={formProps.handleBlur}
          value={formProps.values[fieldName]}
          // error={
          //   formProps.touched[fieldName] && Boolean(formProps.errors[fieldName])
          // }
          // view={view}
          {...fieldConfig['component-parameters']}
          {...fieldConfig['component-parameters']['InputProps']}
          {...fieldConfig['component-parameters']['SelectProps']}
          {...fieldConfig['component-parameters']['InputLabelProps']}
          {...fieldConfig['component-parameters']['FormHelperTextProps']}
        />
      </Box>
    );
  }

  getViewList() {
    const {currentView} = this.state;
    if (currentView !== null) {
      const viewList: Array<string> = this.props.uiSpec['views'][currentView][
        'fields'
      ];
      return viewList;
    }
    return [];
  }

  getFields() {
    const {currentView} = this.state;
    if (currentView !== null) {
      const fields: {[key: string]: {[key: string]: any}} = this.props.uiSpec[
        'fields'
      ];
      return fields;
    }
    return {};
  }

  getValidationSchema() {
    /***
     * Formik requires a single object for validationSchema, collect these from the ui schema
     * and transform via yup.ast
     */
    const viewList = this.getViewList();
    const fields = this.getFields();
    const validationSchema = Object();
    viewList.forEach(fieldName => {
      validationSchema[fieldName] = fields[fieldName]['validationSchema'];
    });
    return transformAll([['yup.object'], ['yup.shape', validationSchema]]);
  }

  getInitialValues() {
    /***
     * Formik requires a single object for initialValues, collect these from the ui schema
     */
    const viewList = this.getViewList();
    const fields = this.getFields();
    const initialValues = Object();
    viewList.forEach(fieldName => {
      initialValues[fieldName] = fields[fieldName]['initialValue'];
    });
    return initialValues;
  }

  render() {
    const uiSpec = this.props.uiSpec;
    const viewName = this.state.currentView;
    if (viewName !== null) {
      const viewList: Array<string> = uiSpec['views'][viewName]['fields'];

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
                this.save(values);
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
                        Form has errors, please scroll up and make changes
                        before re-submitting.
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
                    <Box
                      bgcolor={grey[200]}
                      p={2}
                      style={{overflowX: 'scroll'}}
                    >
                      <pre>{JSON.stringify(formProps, null, 2)}</pre>
                    </Box>
                  </Grid>
                </Grid>
              </Form>
            )}
          </Formik>
        </React.Fragment>
      );
    } else {
      return <div>Loading UI...</div>;
    }
  }
}
