import React from 'react';
import {Button, Grid, Box} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import grey from '@material-ui/core/colors/grey';
import CircularProgress from '@material-ui/core/CircularProgress';
import {getComponentByName} from './ComponentRegistry';
import {getUiSpecForProject} from '../uiSpecification';
import {
  Formik,
  Form,
  Field,
  FormikProps,
  useFormikContext,
  FormikContext,
  FormikContextType,
} from 'formik';
import {transformAll} from '@demvsystems/yup-ast';
import {ViewComponent} from './view';
import {upsertFAIMSData} from '../dataStorage';
import {ProjectUIModel} from '../datamodel';
import {getStagedData, setStagedData} from '../sync/staging';
import {TrendingUp} from '@material-ui/icons';
import {couldStartTrivia} from 'typescript';

type FormProps = {
  activeProjectID: string;
  observation: {_id: string; _rev: string} | null;
};

// After this many errors happen with from the staging db
// on consequitive calls, the error is bubbled up to this
// FormState's stagingError.
const MAX_CONSEQUTIVE_STAGING_SAVE_ERRORS = 5;

const STAGING_SAVE_CYCLE = 2000;

type FormState = {
  stagingError: unknown | null;
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

  // To avoid staging saves that take more than 2 seconds overlapping,
  // the second one stops early if it finds this true,
  // (Set by any running staging save)
  staging = false;
  // Return from setInterval
  stageInterval: null | number = null;
  // Set to empty set when staging saves current fields
  // Added to whenever intercept is called
  touchedFields = new Set<string>();
  // Incrementally increasing revision ID from staging docs.
  lastStagingRev: null | string = null;
  // +1 every time setStagingData errors out. Set to 0 when it doesn't error.
  consequtiveStagingSaveErrors = 0;

  uiSpec: ProjectUIModel | null = null;

  componentDidUpdate(prevProps: FormProps) {
    if (prevProps.activeProjectID !== this.props.activeProjectID) {
      this.staged = {};
      this.uiSpec = null;
      this.setState({currentView: null});
      this.setUISpec();
    }
  }

  constructor(props: FormProps) {
    super(props);
    this.state = {
      currentView: null,
      stagingError: null,
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
          this.staged[viewName] = staged_data_restore || {};
        }
      )
    );

    await Promise.all(viewStageLoaders);
    this.uiSpec = uiSpec;

    this.setState({
      currentView: uiSpec['start_view'],
    });
  }

  requireUiSpec(): ProjectUIModel {
    if (this.uiSpec === null) {
      throw Error(
        'A function requring currentView/uiSpe was called before setUISpec finished'
      );
    }
    return this.uiSpec;
  }

  reqireCurrentView(): string {
    if (this.state.currentView === null) {
      // What should prevent this from happening is the lack of getInitialValues,
      // getComponentFor, etc, function calls in the _Loading Skeleton_.
      // And the loading skeleton is always shown if currentView === null
      throw Error(
        'A function requring currentView/uiSpe was called before setUISpec finished'
      );
    }
    return this.state.currentView;
  }

  save(values: any) {
    console.log(values);
    upsertFAIMSData(this.props.activeProjectID, values);
  }

  updateView(viewName: string) {
    if (viewName in this.requireUiSpec()['views']) {
      this.setState({currentView: viewName});
      this.forceUpdate();
      // Probably not needed, but we *know* we need to rerender when this
      // changes, so let's be explicit.
    } else {
      throw Error(`No view ${viewName}`);
    }
  }

  stopSaving() {
    if (this.stageInterval === null) {
      console.warn('stopSaving called when not already saving');
      return;
    }
    clearInterval(this.stageInterval);
  }

  startSaving(context: FormikContextType<any>) {
    if (this.stageInterval !== null) {
      console.warn('startSaving called whilst saving already');
      return;
      // clearInterval(this.stageInterval);
    }

    const main_save_func = () => {
      if (this.staging) {
        console.warn('Last stage save took longer than ', STAGING_SAVE_CYCLE);
        return;
      }
      this.staging = true;
      if (this.state.currentView === null) {
        console.debug('Attempt to save whilst UI is loading something else');
        return;
      }
      const currentView = this.state.currentView;

      this.touchedFields.forEach(fieldName => {
        const fieldValue = context.getFieldMeta(fieldName)?.value;
        if (fieldValue !== undefined) {
          this.staged[currentView][fieldName] = fieldValue;
        } else {
          console.warn("Formik didn't give a value for ", fieldName);
        }
      });

      // this.touchedFields.clear();

      setStagedData(
        this.staged[currentView],
        this.lastStagingRev,
        this.props.activeProjectID,
        this.reqireCurrentView(),
        this.props.observation
      )
        .then(set_ok => {
          this.lastStagingRev = set_ok.rev;
          this.consequtiveStagingSaveErrors = 0;
        })
        .catch(err => {
          this.consequtiveStagingSaveErrors += 1;
          if (
            this.consequtiveStagingSaveErrors ===
            MAX_CONSEQUTIVE_STAGING_SAVE_ERRORS
          ) {
            this.setState({
              stagingError: err,
            });
          }
        })
        .finally(() => {
          this.staging = false;
        });
    };

    this.stageInterval = window.setInterval(main_save_func, STAGING_SAVE_CYCLE);
  }

  interceptChange<E>(
    handleChange: (evt: E) => unknown,
    fieldName: string,
    evt: E & {currentTarget: {name: string}}
  ): void {
    handleChange(evt);
    this.touchedFields.add(fieldName);
  }

  getComponentFromField(fieldName: string, view: ViewComponent) {
    // console.log('getComponentFromField');
    const uiSpec = this.requireUiSpec();
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
        <Field
          component={Component} //e.g, TextField (default <input/>)
          name={fieldName}
          onChange={(evt: React.ChangeEvent<{name: string}>) =>
            this.interceptChange(formProps.handleChange, fieldName, evt)
          }
          onBlur={(evt: React.FocusEvent<{name: string}>) =>
            this.interceptChange(formProps.handleBlur, fieldName, evt)
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
      </Box>
    );
  }

  getFieldNames() {
    const currentView = this.reqireCurrentView();
    const fieldNames: Array<string> = this.requireUiSpec()['views'][
      currentView
    ]['fields'];
    return fieldNames;
  }

  getFields() {
    const fields: {[key: string]: {[key: string]: any}} = this.requireUiSpec()[
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
    const uiSpec = this.uiSpec;
    const viewName = this.state.currentView;
    if (viewName !== null && uiSpec !== null) {
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
                <FormikContext.Consumer>
                  {formikContext => {
                    this.startSaving(formikContext);
                    return (
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
                            color={
                              formProps.isSubmitting ? 'default' : 'primary'
                            }
                            variant="contained"
                            onClick={formProps.submitForm}
                            disableElevation
                            disabled={formProps.isSubmitting}
                          >
                            {formProps.isSubmitting
                              ? 'Submitting...'
                              : 'Submit'}
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
                    );
                  }}
                </FormikContext.Consumer>
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
