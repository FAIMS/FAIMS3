/*
 * Copyright 2021 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: form.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {Button, Grid, Box, ButtonGroup, Typography} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import grey from '@material-ui/core/colors/grey';
import CircularProgress from '@material-ui/core/CircularProgress';
import {getComponentByName} from '../../ComponentRegistry';
import {getUiSpecForProject} from '../../../uiSpecification';
import {Formik, Form, Field, FormikProps, FormikValues} from 'formik';
import {transformAll} from '@demvsystems/yup-ast';
import {ViewComponent} from '../../view';
import {upsertFAIMSData, lookupFAIMSDataID} from '../../../data_storage';
import {ProjectUIModel} from '../../../datamodel';
import {getStagedData, setStagedData} from '../../../sync/staging';
import {getCurrentUserId} from '../../../users';
import BoxTab from '../ui/boxTab';
import {ActionType} from '../../../actions';
import {store} from '../../../store';
import AutoSave from './autosave';
import * as ROUTES from '../../../constants/routes';
import {withRouter} from 'react-router-dom';
import {RouteComponentProps} from 'react-router';

type ObservationFormProps = {
  project_id: string;
  observation_id: string;
  revision_id?: string;
  is_fresh: boolean;
};

// After this many errors happen with from the staging db
// on consecutive calls, the error is bubbled up to this
// FormState's stagingError.
const MAX_CONSEQUTIVE_STAGING_SAVE_ERRORS = 5;

const STAGING_SAVE_CYCLE = 5000;

type ObservationFormState = {
  stagingError: string | null;
  currentView: string | null;
  initialValues: {[fieldName: string]: unknown} | null;
  is_saving: boolean;
  last_saved: Date;
};

/**
 * Given a list of values, returns the first from the list that isn't null/undefined
 * This is to be used instead of list[0] || list[1] || list[2]
 * in the case that list can contain the number 0
 *
 * @param list List of undefineds, nulls, or anything else
 * @returns Always returns null or a defined value, this never returns undefined.
 */
function firstDefinedFromList<T>(
  list: NonNullable<T>[]
): NonNullable<T> | null {
  if (list.length === 0) {
    return null;
  } else if (list[0] === undefined || list[0] === null) {
    return firstDefinedFromList(list.slice(1));
  } else {
    return list[0];
  }
}

class ObservationForm extends React.Component<
  ObservationFormProps & RouteComponentProps,
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

  // List of timeouts that unmount must cancel
  timeouts: typeof setTimeout[] = [];

  componentDidUpdate(prevProps: ObservationFormProps) {
    if (
      prevProps.observation_id !== this.props.observation_id ||
      prevProps.revision_id !== this.props.revision_id ||
      prevProps.is_fresh !== this.props.is_fresh
    ) {
      this.loadedStagedData = null;
      this.touchedFields.clear();
      this.lastStagingRev = null;

      this.setState({initialValues: null});
      this.setStagedValues().then(this.setInitialValues);
    }
  }

  constructor(props: ObservationFormProps & RouteComponentProps) {
    super(props);
    this.state = {
      currentView: null,
      stagingError: null,
      initialValues: null,
      is_saving: false,
      last_saved: new Date(),
    };
    this.getComponentFromField = this.getComponentFromField.bind(this);
    this.getValidationSchema = this.getValidationSchema.bind(this);
    this.setState = this.setState.bind(this);
    this.setInitialValues = this.setInitialValues.bind(this);
    this.getFieldNames = this.getFieldNames.bind(this);
    this.getFields = this.getFields.bind(this);
  }

  async componentDidMount() {
    try {
      await this.setUISpec();
    } catch (err) {
      console.error('setUISpec error', err);
      this.context.dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message:
            'Project is not fully downloaded or not setup correctly (UI Specification Missing)',
          severity: 'error',
        },
      });
      // This form cannot be shown at all. No recovery except go back to project.
      this.props.history.goBack();
      return;
    }
    try {
      await this.setStagedValues();
    } catch (err) {
      console.error('setStagedValues error', err);
      this.context.dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message: 'Could not load previous data: ' + err.message,
          severity: 'warnings',
        },
      });
      // Empty staged data, this isn't as severe if the staged data can't be loaded.
      this.loadedStagedData = {};
    }
    try {
      await this.setInitialValues();
    } catch (err) {
      console.error('setInitialValues error', err);
      this.context.dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message: 'Could not load previous data: ' + err.message,
          severity: 'warnings',
        },
      });
      // Show an empty form
      this.setState({initialValues: {_id: this.props.observation_id!}});
    }
  }

  componentWillUnmount() {
    for (const timeout_id of this.timeouts) {
      clearTimeout(
        (timeout_id as unknown) as Parameters<typeof clearTimeout>[0]
      );
    }
    if (this.stageInterval !== null) {
      clearInterval(this.stageInterval);
    }
  }

  async setUISpec() {
    // CurrentView & loadedStagedData are assumed to need updating when this is called
    // (They need updating if this.props.observation changes)
    // but uiSpec might not need updating here

    if (this.uiSpec === null) {
      this.uiSpec = await getUiSpecForProject(this.props.project_id);
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
      this.nullCoalesceRevision().then(obsid_revid =>
        getStagedData(this.props.project_id, viewName, obsid_revid).then(
          staged_data_restore => {
            loadedStagedData = {
              ...loadedStagedData,
              ...(staged_data_restore || {}),
            };
          }
        )
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
    } = (this.props.is_fresh
      ? {}
      : await lookupFAIMSDataID(
          this.props.project_id,
          this.props.observation_id
        )
    )?.data;
    const fieldNames = this.getFieldNames();
    const fields = this.getFields();
    const initialValues: {[key: string]: any} = {
      _id: this.props.observation_id!,
    };
    fieldNames.forEach(fieldName => {
      initialValues[fieldName] = firstDefinedFromList([
        this.loadedStagedData![fieldName],
        existingData?.[fieldName],
        fields[fieldName]['initialValue'],
      ]);
    });
    this.setState({initialValues: initialValues});
  }

  async nullCoalesceRevision(): Promise<null | {_id: string; _rev: string}> {
    if (this.props.is_fresh) {
      return null;
    } else {
      const existing_doc = await lookupFAIMSDataID(
        this.props.project_id,
        this.props.observation_id
      );
      if (existing_doc === null) {
        console.error('observation form created for deleted document');
      }
      return {
        _id: this.props.observation_id,
        _rev: this.props.revision_id || existing_doc!._rev!,
      };
    }
  }

  /**
   * Equivalent to setTimeout, but with added function that
   * clears any timeouts when the component is unmounted.
   * @param callback Function to run when timeout elapses
   */
  setTimeout(callback: () => void, time: number) {
    const my_index = this.timeouts.length;
    setTimeout(() => {
      try {
        callback();
        this.timeouts.splice(my_index, 1);
      } catch (err) {
        this.timeouts.splice(my_index, 1);
        throw err;
      }
    }, time);
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
    getCurrentUserId(this.props.project_id)
      .then(userid => {
        console.assert(values['_id'] === this.props.observation_id);
        delete values['_id'];
        const created = new Date('1990-01-01'); // FIXME
        const now = new Date();
        const doc = {
          observation_id: this.props.observation_id,
          _rev: undefined as undefined | string,
          type: '??:??',
          data: values,
          created_by: userid, // get this from the form
          updated_by: userid,
          created: created,
          updated: now,
        };
        if (!this.props.revision_id !== null) {
          doc._rev = this.props.revision_id;
        }
        console.log(doc);
        return doc;
      })
      .then(doc => {
        return upsertFAIMSData(this.props.project_id, doc);
      })
      .then(result => {
        console.debug(result);
        const message = this.props.is_fresh
          ? 'Observation successfully created'
          : 'Observation successfully updated';
        this.context.dispatch({
          type: ActionType.ADD_ALERT,
          payload: {
            message: message,
            severity: 'success',
          },
        });
      })
      .catch(err => {
        const message = this.props.is_fresh
          ? 'Could not create observation'
          : 'Could not update observation';
        this.context.dispatch({
          type: ActionType.ADD_ALERT,
          payload: {
            message: message,
            severity: 'error',
          },
        });
        console.warn(err);
        console.error('Failed to save data');
      })
      // Clear the staging area (Possibly after redirecting back to project page)
      .then(() => this.nullCoalesceRevision())
      .then(obsid_revid =>
        setStagedData(
          {},
          this.lastStagingRev,
          this.props.project_id,
          this.reqireCurrentView(),
          obsid_revid
        ).catch(clean_error => {
          // Errors with cleaning the staging area are not 'fatal' to the
          // redirect
          console.warn('failed to clear staging area', clean_error);
        })
      )
      .then(() => {
        // if a new observation, redirect to the new observation page to allow
        // the user to rapidly add more records
        if (this.props.is_fresh) {
          this.props.history.push(
            ROUTES.PROJECT + this.props.project_id + ROUTES.OBSERVATION_CREATE
          );
          window.scrollTo(0, 0);
          // scroll to top of page, seems to be needed on mobile devices
        } else {
          // otherwise, redirect to the project page listing all observations
          this.props.history.push(ROUTES.PROJECT + this.props.project_id);
        }
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

      this.nullCoalesceRevision().then(obsid_revid => {
        this.setState({is_saving: true});
        setStagedData(
          loadedStagedData,
          this.lastStagingRev,
          this.props.project_id,
          this.reqireCurrentView(),
          obsid_revid
        )
          .then(set_ok => {
            this.lastStagingRev = set_ok.rev;
            this.consequtiveStagingSaveErrors = 0;
            this.setTimeout(() => {
              this.setState({is_saving: false, last_saved: new Date()});
            }, 1000);
          })
          .catch(err => {
            this.consequtiveStagingSaveErrors += 1;
            if (
              this.consequtiveStagingSaveErrors ===
              MAX_CONSEQUTIVE_STAGING_SAVE_ERRORS
            ) {
              this.setState({
                stagingError: JSON.stringify(err),
                is_saving: false,
              });
            }
          })
          .finally(() => {
            this.staging = false;
          });
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
              this.setTimeout(() => {
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
                    <Grid item xs={12}>
                      <AutoSave
                        last_saved={this.state.last_saved}
                        is_saving={this.state.is_saving}
                        error={this.state.stagingError}
                      />
                    </Grid>
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
                      <ButtonGroup
                        color="primary"
                        aria-label="contained primary button group"
                      >
                        <Button
                          type="submit"
                          color={formProps.isSubmitting ? 'default' : 'primary'}
                          variant="contained"
                          onClick={formProps.submitForm}
                          disableElevation
                          disabled={formProps.isSubmitting}
                        >
                          {formProps.isSubmitting
                            ? !this.props.is_fresh
                              ? 'Working...'
                              : 'Working...'
                            : !this.props.is_fresh
                            ? 'Update'
                            : 'Save and new'}
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
                      </ButtonGroup>
                    </Grid>
                    <Grid item sm={6} xs={12}>
                      <BoxTab title={'Developer tool: form state'} />
                      <Box
                        bgcolor={grey[200]}
                        pl={2}
                        pr={2}
                        style={{overflowX: 'scroll'}}
                      >
                        <pre>{JSON.stringify(formProps, null, 2)}</pre>
                      </Box>
                      <Box mt={3}>
                        <BoxTab
                          title={'Alpha info: Autosave, validation and syncing'}
                        />
                        <Box bgcolor={grey[200]} p={2}>
                          <p>
                            The data in this form are auto-saved locally within
                            the app every 5 seconds. The data do not need to be
                            valid, and you can return to this page to complete
                            this observation on this device at any time.
                          </p>
                          <p>
                            Once you are ready, click the{' '}
                            <Typography variant="button">
                              <b>
                                {this.props.is_fresh
                                  ? 'save and new'
                                  : 'update'}
                              </b>
                            </Typography>{' '}
                            button. This will firstly validate the data, and if
                            valid, sync the observation to the remote server.
                          </p>
                        </Box>
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
ObservationForm.contextType = store;
export default withRouter(ObservationForm);
