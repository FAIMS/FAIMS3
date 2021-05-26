import React from 'react';
import {Button, Grid, Box} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import grey from '@material-ui/core/colors/grey';
import CircularProgress from '@material-ui/core/CircularProgress';
import {getComponentByName} from '../ComponentRegistry';
import {getUiSpecForProject} from '../../uiSpecification';
import {Formik, Form, Field, FormikProps, FormikValues} from 'formik';
import {transformAll} from '@demvsystems/yup-ast';
import {ViewComponent} from '../view';
import {
  upsertFAIMSData,
  generateFAIMSDataID,
  lookupFAIMSDataID,
} from '../../dataStorage';
import {ProjectUIModel} from '../../datamodel';
import {getStagedData, setStagedData} from '../../sync/staging';
import {getCurrentUserId} from '../../users';

type ObservationFormProps = {
  listing_id_project_id: string;
  observation_id: string;
  observation?: {_id: string; _rev: string};
};

// After this many errors happen with from the staging db
// on consequitive calls, the error is bubbled up to this
// FormState's stagingError.
const MAX_CONSEQUTIVE_STAGING_SAVE_ERRORS = 5;

const STAGING_SAVE_CYCLE = 2000;

type ObservationFormState = {
  stagingError: unknown | null;
  currentView: string | null;
  initialValues: {[fieldName: string]: unknown} | null;
};

export class ObservationForm extends React.Component<
  ObservationFormProps,
  ObservationFormState
> {
  // Staging data that is ONLY updated from setUISpec, used in getInitialValues
  // that means this ISN'T up-to-date with the data in the form.
  // Reset when current observation/project changes
  loadedStagedData: null | {
    [fieldName: string]: unknown;
  } = null;

  // To avoid staging saves that take more than 2 seconds overlapping,
  // the second one stops early if it finds this true,
  // (Set by any running staging save)
  staging = false;

  // Return from setInterval, when the staging save is running.
  stageInterval: null | number = null;

  // Keeps track of any fields that have changed from their initial values
  // This is different from formik's FormikProps.touched, in that it tracks
  // when the values change before the blur event (i.e. listens for onChange AND onBlur)
  // Used for determining what to save to the staging area.
  // Starts out as empty set even if there was data loaded from the staging area.
  // Reset when current observation/project changes
  touchedFields = new Set<string>();

  // Incrementally increasing revision ID from staging docs.
  // Reset when current observation/project changes
  lastStagingRev: null | string = null;

  // +1 every time setStagingData errors out. Set to 0 when it doesn't error.
  consequtiveStagingSaveErrors = 0;

  uiSpec: ProjectUIModel | null = null;

  // When this.props.observation === undefined, then this is generated to be the ID
  // of this forms document.
  // Otherwise it is a copy of this.props.observation
  // Maintained by componentDidUpdate.
  obsid: string;

  componentDidUpdate(prevProps: ObservationFormProps) {
    //  I don't think this is needed here - there will always be
    //  an observation_id passed from the url parameter

    // // Only generate a new ID when obsid is not already generated.
    // this.obsid =
    //   this.props.observation?._id || this.obsid || generateFAIMSDataID();

    if (prevProps.observation?._rev !== this.props.observation?._rev) {
      this.loadedStagedData = null;
      this.touchedFields.clear();
      this.lastStagingRev = null;

      const cb = () => this.setStagedValues().then(this.setInitialValues);

      // uiSpec & currentView re-load is only necessary if activeProjectID changed.
      // Again - the listing_id_project_id will not change.
      // if (
      //   prevProps.listing_id_project_id !== this.props.listing_id_project_id
      // ) {
      //   // this.uiSpec = null;
      //   // this.setState({currentView: null, initialValues: null});
      //   // this.setUISpec().then(cb);
      // } else {
      //   this.setState({initialValues: null});
      //   cb();
      // }
      this.setState({initialValues: null});
      cb();
    }
  }

  constructor(props: ObservationFormProps) {
    super(props);

    this.obsid = this.props.observation?._id || generateFAIMSDataID();
    this.state = {
      currentView: null,
      stagingError: null,
      initialValues: null,
    };
    this.getComponentFromField = this.getComponentFromField.bind(this);
    this.getValidationSchema = this.getValidationSchema.bind(this);
    this.setState = this.setState.bind(this);
    this.setInitialValues = this.setInitialValues.bind(this);
    this.getFieldNames = this.getFieldNames.bind(this);
    this.getFields = this.getFields.bind(this);
  }

  async componentDidMount() {
    await this.setUISpec();
    await this.setStagedValues();
    await this.setInitialValues();
  }

  async setUISpec() {
    // CurrentView & loadedStagedData are assumed to need updating when this is called
    // (They need updating if this.props.observation changes)
    // but uiSpec might not need updating here

    if (this.uiSpec === null) {
      this.uiSpec = await getUiSpecForProject(this.props.listing_id_project_id);
    }

    this.setState({
      currentView: this.uiSpec['start_view'],
    });
  }

  async setStagedValues() {
    const uiSpec = this.requireUiSpec();
    // Load data from staging DB
    let loadedStagedData: {[fn: string]: unknown} = {};

    const viewStageLoaders = Object.entries(uiSpec['views']).map(([viewName]) =>
      getStagedData(this.props.listing_id_project_id, viewName, null).then(
        staged_data_restore => {
          loadedStagedData = {
            ...loadedStagedData,
            ...(staged_data_restore || {}),
          };
        }
      )
    );

    // Wait for all data to load from staging DB before setting this.staged not null
    await Promise.all(viewStageLoaders);
    this.loadedStagedData = loadedStagedData;
  }

  async setInitialValues() {
    /***
     * Formik requires a single object for initialValues, collect these from the
     * ui schema or from the database
     */
    const existingData: {
      [viewName: string]: {[fieldName: string]: unknown};
    } = (this.props.observation === undefined
      ? {}
      : await lookupFAIMSDataID(this.props.listing_id_project_id, this.obsid)
    )?.data;
    const fieldNames = this.getFieldNames();
    const fields = this.getFields();
    const initialValues: {[key: string]: any} = {
      _id: this.obsid!,
    };
    fieldNames.forEach(fieldName => {
      initialValues[fieldName] =
        this.loadedStagedData![fieldName] ||
        existingData?.[fieldName] ||
        fields[fieldName]['initialValue'];
    });
    this.setState({initialValues: initialValues});
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
    getCurrentUserId(this.props.listing_id_project_id)
      .then(userid => {
        console.assert(values['_id'] === this.obsid);
        delete values['_id'];
        const created = new Date('1990-01-01'); // FIXME
        const now = new Date();
        const doc = {
          _id: this.obsid,
          _rev: undefined as undefined | string,
          type: '??:??',
          data: values,
          created_by: userid, // get this from the form
          updated_by: userid,
          created: created,
          updated: now,
        };
        if (this.props.observation) {
          doc._rev = this.props.observation._rev;
        }
        console.log(doc);
        return doc;
      })
      .then(doc => {
        return upsertFAIMSData(this.props.listing_id_project_id, doc);
      })
      .then(result => {
        console.debug(result);
      })
      .catch(err => {
        console.warn(err);
        console.error('Failed to save data');
      });
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

  lastValues: FormikValues | null = null;

  updateLastValues(values: FormikValues) {
    this.lastValues = values;
    if (this.stageInterval !== null) {
      // It is now OK to clal updateLastValues whenever,
      // just to update the formikProps.values
      return;
    }

    /*
        This main_save_func is run every 2 seconds, when this.lastValues !== null
        It saves this.lastValues to the staging DB.

        Any errors that occur within are pushed to this.state.stagingArea,
        but only after MAX_CONSEQUTIVE_STAGING_SAVE_ERRORS errors occurred in consequitive invokations
        */
    const main_save_func = () => {
      if (this.staging) {
        console.warn('Last stage save took longer than ', STAGING_SAVE_CYCLE);
        return;
      }
      this.staging = true;
      // These may occur after the user switches tabs.
      if (this.loadedStagedData === null) {
        console.debug('Attempt to save whilst UI is loading something else');
        return;
      }
      const loadedStagedData = this.loadedStagedData;
      if (this.state.currentView === null) {
        console.debug('Attempt to save whilst UI is loading something else');
        return;
      }

      this.touchedFields.forEach(fieldName => {
        const fieldValue = this.lastValues![fieldName];
        if (fieldValue !== undefined) {
          loadedStagedData[fieldName] = fieldValue;
        } else {
          console.warn("Formik didn't give a value for ", fieldName);
        }
      });

      setStagedData(
        loadedStagedData,
        this.lastStagingRev,
        this.props.listing_id_project_id,
        this.reqireCurrentView(),
        this.props.observation || null
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
    formProps: FormikProps<any>,
    fieldName: string,
    evt: E & {currentTarget: {name: string}}
  ): void {
    handleChange(evt);
    this.touchedFields.add(fieldName);
    this.updateLastValues(formProps.values);
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
          component={Component} //e.g, TextField (default <input>)
          name={fieldName}
          onChange={(evt: React.ChangeEvent<{name: string}>) =>
            this.interceptChange(
              formProps.handleChange,
              formProps,
              fieldName,
              evt
            )
          }
          onBlur={(evt: React.FocusEvent<{name: string}>) =>
            this.interceptChange(
              formProps.handleBlur,
              formProps,
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

  render() {
    const uiSpec = this.uiSpec;
    const viewName = this.state.currentView;
    if (
      viewName !== null &&
      this.state.initialValues !== null &&
      uiSpec !== null
    ) {
      const fieldNames = this.getFieldNames();

      return (
        <React.Fragment>
          <Formik
            initialValues={this.state.initialValues}
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
            {formProps => {
              this.updateLastValues(formProps.values);
              return (
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
              );
            }}
          </Formik>
        </React.Fragment>
      );
    } else {
      return (
        <div>
          <CircularProgress size={20} thickness={5} />
        </div>
      );
    }
  }
}
