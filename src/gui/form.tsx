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
import {upsertFAIMSData} from '../dataStorage';
import {ProjectUIModel} from '../datamodel';
import {getStagedData, setStagedData} from '../sync/staging';

type FormProps = {
  activeProjectID: string;
  uiSpec: ProjectUIModel;
  observation: {_id: string; _rev: string} | null;
};

// After this many errors happen with from the staging db
// on consequitive calls, the error is bubbled up to this
// FormState's stagingError.
const MAX_CONSEQUTIVE_STAGING_SAVE_ERRORS = 5;

const STAGING_SAVE_CYCLE = 2000;

type FormState = {
  stagingState: ['error', unknown] | 'idle' | 'staging';
  currentView: string | null;
};

export class FAIMSForm extends React.Component<FormProps, FormState> {
  // Staging data that is ONLY updated from setUISpec, used in getInitialValues
  // that means this ISN'T up-to-date with the data in the form.
  staged: {
    [view: string]: {
      [fieldName: string]: unknown;
    };
  } = {};
  stagingNow = false;
  continueStaging: 0 | 1 | 2 = 0;
  lastStagingRev: string | null = null;
  touchedFields = new Set<string>();

  consequtiveStagingSaveErrors = 0;

  componentDidUpdate(prevProps: FormProps) {
    if (prevProps.activeProjectID !== this.props.activeProjectID) {
      this.staged = {};
      this.setState({currentView: null});
      this.setUISpec();
    }
  }

  constructor(props: FormProps) {
    super(props);
    this.state = {
      currentView: null,
      stagingState: 'idle',
    };
    this.getComponentFromField = this.getComponentFromField.bind(this);
    this.getValidationSchema = this.getValidationSchema.bind(this);
    this.getInitialValues = this.getInitialValues.bind(this);
    this.setState = this.setState.bind(this);
    this.getFieldNames = this.getFieldNames.bind(this);
    this.getFields = this.getFields.bind(this);
  }

  async componentDidMount() {
    await this.setUISpec();
  }

  async setUISpec() {
    const uiSpec = await getUiSpecForProject(this.props.activeProjectID);
    // All staged data must either be loaded or error out
    // before we allow the user to edit it (Prevents overwriting stuff the user starts writing if they're quick)

    const viewStageLoaders = Object.entries(uiSpec['views']).map(([viewName]) =>
      getStagedData(this.props.activeProjectID, viewName, null).then(
        staged_data_restore => {
          if (staged_data_restore !== null)
            this.staged[viewName] = staged_data_restore;
        }
      )
    );

    await Promise.all(viewStageLoaders);
    this.setState({
      currentView: uiSpec['start_view'],
    });
  }

  reqireCurrentView(): string {
    if (this.state.currentView === null) {
      // What should prevent this from happening is the lack of getInitialValues,
      // getComponentFor, etc, function calls in the _Loading Skeleton_.
      // And the loading skeleton is always shown if currentView === null
      throw Error(
        'A function requiring currentView was called before currentView instantiated'
      );
    }
    return this.state.currentView;
  }

  save(values: any) {
    console.log(values);
    upsertFAIMSData(this.props.activeProjectID, values);
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

  saveToStaging(fields: string[], context: FormikContextType<any>) {
    if (this.stagingNow) {
      console.log('Queueing');
      this.continueStaging = 2;
      return;
    }
    console.log('Freshly staging');
    this.stagingNow = true;

    const main_save_func = () => {
      console.debug('Main save func');
      const newValues: {[fieldName: string]: unknown} = {};

      this.touchedFields.forEach(fieldName => {
        const fieldValue = context.getFieldMeta(fieldName)?.value;
        if (fieldValue !== undefined) {
          newValues[fieldName] = fieldValue;
        } else {
          console.warn("Formik didn't give a value for ", fieldName);
        }
      });

      setStagedData(
        newValues,
        this.lastStagingRev,
        this.props.activeProjectID,
        this.reqireCurrentView(),
        this.props.observation
      ).then(value => {
        this.lastStagingRev = value.rev;
        // After data is set, there have been more data in the meantime
        if (this.continueStaging !== 0) {
          this.continueStaging -= 1;
          this.stagingNow = true;
          // Recursion is done like this so that stagingNow never has to turn false.
          setTimeout(main_save_func, STAGING_SAVE_CYCLE);
        } else {
          // This last setStagedData is the most up-to-date,
          // since no more saveToStaging() calls happened since then.
          this.stagingNow = false;
        }
      });
    };

    // Since this function is run from interceptChange, a change handler
    // We don't want it waiting for PouchDB to enter a keystroke
    // so this is done asynchronously:
    setTimeout(main_save_func, 100);
  }

  interceptChange<E>(
    context: FormikContextType<any>,
    handleChange: (evt: E) => unknown,
    // formikProps.values. Everything except the currently 'focused' field is used from this.
    otherValues: {[key: string]: unknown},
    fieldName: string,
    evt: E & {currentTarget: {name: string}}
  ): void {
    handleChange(evt);
    this.touchedFields.add(fieldName);

    this.saveToStaging(Object.keys(otherValues), context);
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
    let Component: React.Component;
    try {
      Component = getComponentByName(namespace, name);
    } catch (err) {
      // console.debug(err);
      // console.warn(`Failed to load component ${namespace}::${name}`);
      return undefined;
    }
    const formProps: FormikProps<{[key: string]: unknown}> =
      view.props.formProps;
    return (
      <Box mb={3} key={fieldName}>
        <FormikContext.Consumer>
          {formikContext => (
            <Field
              component={Component} //e.g, TextField (default <input/>)
              name={fieldName}
              onChange={(
                evt: React.ChangeEvent<{name: string}>,
                value: string
              ) =>
                this.interceptChange(
                  formikContext,
                  formProps.handleChange,
                  formProps.values,
                  fieldName,
                  evt
                )
              }
              onBlur={(evt: React.FocusEvent<{name: string}>, value: string) =>
                this.interceptChange(
                  formikContext,
                  formProps.handleBlur,
                  formProps.values,
                  fieldName,
                  evt
                )
              }
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
          )}
        </FormikContext.Consumer>
      </Box>
    );
  }

  getFieldNames() {
    const currentView = this.reqireCurrentView();
    const fieldNames: Array<string> = this.props.uiSpec['views'][currentView][
      'fields'
    ];
    return fieldNames;
  }

  getFields() {
    const fields: {[key: string]: {[key: string]: any}} = this.props.uiSpec[
      'fields'
    ];
    return fields;
  }

  getValidationSchema() {
    /***
     * Formik requires a single object for validationSchema, collect these from the ui schema
     * and transform via yup.ast
     */
    const fieldNames = this.getFieldNames();
    const fields = this.getFields();
    const validationSchema = Object();
    fieldNames.forEach(fieldName => {
      validationSchema[fieldName] = fields[fieldName]['validationSchema'];
    });
    return transformAll([['yup.object'], ['yup.shape', validationSchema]]);
  }

  getInitialValues() {
    /***
     * Formik requires a single object for initialValues, collect these from the ui schema
     */
    const currentView = this.reqireCurrentView();
    const fieldNames = this.getFieldNames();
    const fields = this.getFields();
    const initialValues = Object();
    fieldNames.forEach(fieldName => {
      initialValues[fieldName] =
        this.staged[currentView][fieldName] ||
        fields[fieldName]['initialValue'];
    });
    return initialValues;
  }

  render() {
    const uiSpec = this.props.uiSpec;
    const viewName = this.state.currentView;
    if (viewName !== null) {
      const fieldNames: Array<string> = uiSpec['views'][viewName]['fields'];

      return (
        <React.Fragment>
          <Formik
            initialValues={this.getInitialValues()}
            validationSchema={this.getValidationSchema}
            validateOnMount={true}
            onSubmit={(values, {setSubmitting}) => {
              setTimeout(() => {
                setSubmitting(false);
                console.log('SUBMITTING', JSON.stringify(values, null, 2));
              }, 500);
            }}
          >
            {formProps => (
              <Form>
                <Grid container spacing={2}>
                  <Grid item sm={6} xs={12}>
                    <ViewComponent
                      viewList={fieldNames}
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
