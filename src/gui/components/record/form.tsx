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
import {withRouter} from 'react-router-dom';
import {RouteComponentProps} from 'react-router';

import {Formik, Form, Field, FormikProps} from 'formik';

import {
  Button,
  Grid,
  Box,
  ButtonGroup,
  Typography,
  Step,
  Stepper,
  StepButton,
} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import grey from '@material-ui/core/colors/grey';
import CircularProgress from '@material-ui/core/CircularProgress';

import {transformAll} from '@demvsystems/yup-ast';

import {getComponentByName} from '../../component_registry';
import {ViewComponent} from '../../view';
import {upsertFAIMSData, getFullRecordData} from '../../../data_storage';
import {ProjectID, RecordID, RevisionID} from '../../../datamodel/core';
import {ProjectUIModel} from '../../../datamodel/ui';
import {getCurrentUserId} from '../../../users';
import BoxTab from '../ui/boxTab';
import {ActionType} from '../../../actions';
import {store} from '../../../store';
import AutoSave from './autosave';
import * as ROUTES from '../../../constants/routes';
import RecordStagingState from '../../../sync/staging-observation';

type RecordFormProps = {
  project_id: ProjectID;
  // Might be given in the URL:
  view_default?: string;
  uiSpec: ProjectUIModel;
  record_id: RecordID;
} & (
  | {
      // When editing existing record, we require the caller to know its revision
      revision_id: RevisionID;
      // When editing existing record, type comes from record
      type?: undefined;
    }
  | {
      // When creating a new record,  revision is not yet created
      revision_id?: undefined;
      // When creating a new record, the user is prompted with viewset/type
      type: string;
    }
);

type RecordFormState = {
  stagingError: string | null;
  type_cached: string | null;
  view_cached: string | null;
  revision_cached: string | null;
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

class RecordForm extends React.Component<
  RecordFormProps & RouteComponentProps,
  RecordFormState
> {
  staging: RecordStagingState;

  // List of timeouts that unmount must cancel
  timeouts: typeof setTimeout[] = [];

  async componentDidUpdate(prevProps: RecordFormProps) {
    if (
      prevProps.project_id !== this.props.project_id ||
      prevProps.record_id !== this.props.record_id ||
      (prevProps.revision_id !== this.props.revision_id &&
        this.state.revision_cached !== this.props.revision_id)
    ) {
      // Stop rendering immediately (i.e. go to loading screen immediately)
      this.setState({
        initialValues: null,
        type_cached: null,
        view_cached: null,
        revision_cached: null,
      });
      // Re-initialize basically everything.
      this.formChanged(true);
    }
  }

  constructor(props: RecordFormProps & RouteComponentProps) {
    super(props);
    this.staging = new RecordStagingState({
      record_id: this.props.record_id,
      project_id: this.props.project_id,
    });
    this.state = {
      type_cached: null,
      view_cached: null,
      revision_cached: null,
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

  componentDidMount() {
    // On mount, staging.start() must be called, so give this false:
    this.formChanged(false);
  }

  saveListener(val: boolean | {}) {
    if (val === true) {
      // Start saving
      this.setState({is_saving: true});
    } else if (val === false) {
      // Finished saving successfully
      this.setState({is_saving: false, last_saved: new Date()});
    } else {
      // Error occurred while saving
      // Heuristically determine a nice user-facing error
      const error_message =
        (val as {message?: string}).message || val.toString();
      console.error('saveListener', val);

      this.setState({is_saving: false, stagingError: error_message});
      this.context.dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message: 'Could not load previous data: ' + error_message,
          severity: 'warnings',
        },
      });
    }
  }

  async formChanged(staging_area_started_already: boolean) {
    try {
      let this_type;
      if (this.props.type === undefined) {
        const latest_record = await getFullRecordData(
          this.props.project_id,
          this.props.record_id,
          this.props.revision_id
        );
        if (latest_record === null) {
          this.setState({
            stagingError: `Could not find data for record ${this.props.record_id}`,
          });
          this.context.dispatch({
            type: ActionType.ADD_ALERT,
            payload: {
              message:
                'Could not load existing record: ' + this.props.record_id,
              severity: 'warnings',
            },
          });
          return;
        } else {
          this_type = latest_record.type;
        }
      } else {
        this_type = this.props.type;
      }

      if (!(this_type in this.props.uiSpec.viewsets)) {
        throw Error(`Viewset for type '${this_type}' is missing`);
      }

      if (!('views' in this.props.uiSpec.viewsets[this_type])) {
        throw Error(
          `Viewset for type '${this_type}' is missing 'views' property'`
        );
      }

      if (this.props.uiSpec.viewsets[this_type].views === []) {
        throw Error(`Viewset for type '${this_type}' has no views`);
      }

      await this.setState({
        type_cached: this_type,
        view_cached: this.props.uiSpec.viewsets[this_type].views[0],
        revision_cached: this.props.revision_id || null,
      });
    } catch (err: any) {
      console.error('setUISpec/setLastRev error', err);
      this.context.dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message: `Project is not fully downloaded or not setup correctly (${err.toString()})`,
          severity: 'error',
        },
      });
      // This form cannot be shown at all. No recovery except go back to project.
      this.props.history.goBack();
      return;
    }
    try {
      // these come after setUISpec & setLastRev has set view_name & revision_id these to not null
      const view_cached = this.requireView();
      const revision_cached = this.state.revision_cached;

      // If the staging area .start() has already been called,
      // The proper way to change the record/revision/etc is this
      // (saveListener is already bound at this point)
      if (staging_area_started_already) {
        this.staging.recordChangeHook(this.props, {
          view_name: view_cached,
          revision_id: revision_cached,
        });
      } else {
        this.staging.saveListener = this.saveListener.bind(this);
        await this.staging.start({
          view_name: view_cached,
          revision_id: revision_cached,
        });
      }
    } catch (err) {
      console.error('rare staging error', err);
    }
    try {
      await this.setInitialValues();
    } catch (err: any) {
      console.error('setInitialValues error', err);
      this.context.dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message: 'Could not load previous data: ' + err.message,
          severity: 'warnings',
        },
      });
      // Show an empty form
      this.setState({
        initialValues: {
          _id: this.props.record_id!,
          _project_id: this.props.project_id,
        },
      });
    }
  }

  componentWillUnmount() {
    for (const timeout_id of this.timeouts) {
      clearTimeout(
        (timeout_id as unknown) as Parameters<typeof clearTimeout>[0]
      );
    }
    this.staging.stop();
  }

  async setInitialValues() {
    /***
     * Formik requires a single object for initialValues, collect these from the
     * (in order high priority to last resort): staging area, database, ui schema
     */
    const database_data =
      this.props.revision_id === undefined
        ? {}
        : (
            await getFullRecordData(
              this.props.project_id,
              this.props.record_id,
              this.props.revision_id
            )
          )?.data || {};

    const staged_data = await this.staging.getInitialValues();

    const fieldNames = this.getFieldNames();
    const fields = this.getFields();

    const initialValues: {[key: string]: any} = {
      _id: this.props.record_id!,
      _project_id: this.props.project_id,
    };
    fieldNames.forEach(fieldName => {
      initialValues[fieldName] = firstDefinedFromList([
        staged_data[fieldName],
        database_data[fieldName],
        fields[fieldName]['initialValue'],
      ]);
    });
    this.setState({initialValues: initialValues});
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

  requireView(): string {
    if (this.state.view_cached === null) {
      // What should prevent this from happening is the lack of getInitialValues,
      // getComponentFor, etc, function calls in the _Loading Skeleton_.
      // And the loading skeleton is always shown if view_cached === null
      throw Error(
        'A function requring view_cached/uiSpe was called before setUISpec finished'
      );
    }
    return this.state.view_cached;
  }

  save(values: any) {
    getCurrentUserId(this.props.project_id)
      .then(userid => {
        const now = new Date();
        const doc = {
          record_id: this.props.record_id,
          revision_id: this.props.revision_id || null,
          type: this.state.type_cached!,
          data: values,
          updated_by: userid,
          updated: now,
        };
        console.log(doc);
        return doc;
      })
      .then(doc => {
        return upsertFAIMSData(this.props.project_id, doc);
      })
      .then(result => {
        console.debug(result);
        const message =
          this.props.revision_id === undefined
            ? 'Record successfully created'
            : 'Record successfully updated';
        this.context.dispatch({
          type: ActionType.ADD_ALERT,
          payload: {
            message: message,
            severity: 'success',
          },
        });
      })
      .catch(err => {
        const message =
          this.props.revision_id === undefined
            ? 'Could not create record'
            : 'Could not update record';
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
      .then(() =>
        this.staging.clear({
          view_name: this.requireView(),
          revision_id: this.state.revision_cached!,
        })
      )
      .then(() => {
        // if a new record, redirect to the new record page to allow
        // the user to rapidly add more records
        if (this.props.revision_id === undefined) {
          this.props.history.push(
            ROUTES.PROJECT +
              this.props.project_id +
              ROUTES.RECORD_CREATE +
              ROUTES.RECORD_TYPE +
              this.state.type_cached
          );
          window.scrollTo(0, 0);
          // scroll to top of page, seems to be needed on mobile devices
        } else {
          // otherwise, redirect to the project page listing all records
          this.props.history.push(ROUTES.PROJECT + this.props.project_id);
        }
      });
  }

  updateView(viewName: string) {
    if (viewName in this.props.uiSpec['views']) {
      this.setState({view_cached: viewName});
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
          onChange={this.staging.createNativeFieldHook<
            React.ChangeEvent<{name: string}>,
            ReturnType<typeof formProps.handleChange>
          >(formProps.handleChange, fieldName)}
          onBlur={this.staging.createNativeFieldHook<
            React.FocusEvent<{name: string}>,
            ReturnType<typeof formProps.handleBlur>
          >(formProps.handleBlur, fieldName)}
          stageValue={this.staging.createCustomFieldHook(
            formProps.setFieldValue,
            fieldName
          )}
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
    const view_cached = this.requireView();
    const fieldNames: Array<string> = this.props.uiSpec['views'][view_cached][
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

  render() {
    const uiSpec = this.props.uiSpec;
    const viewName = this.state.view_cached;
    if (
      viewName !== null &&
      this.state.initialValues !== null &&
      uiSpec !== null
    ) {
      const fieldNames = this.getFieldNames();

      return (
        <React.Fragment>
          <Stepper
            nonLinear
            activeStep={this.props.uiSpec.viewsets[
              this.state.type_cached!
            ].views.indexOf(viewName)}
            alternativeLabel
          >
            {this.props.uiSpec.viewsets[this.state.type_cached!].views.map(
              (view_name: string) => (
                <Step key={view_name}>
                  <StepButton
                    onClick={() => {
                      this.setState({view_cached: view_name});
                    }}
                  >
                    {view_name}
                  </StepButton>
                </Step>
              )
            )}
          </Stepper>
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
              this.staging.renderHook(viewName, formProps.values);
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
                            ? !(this.props.revision_id === undefined)
                              ? 'Working...'
                              : 'Working...'
                            : !(this.props.revision_id === undefined)
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
                            this record on this device at any time.
                          </p>
                          <p>
                            Once you are ready, click the{' '}
                            <Typography variant="button">
                              <b>
                                {this.props.revision_id === undefined
                                  ? 'save and new'
                                  : 'update'}
                              </b>
                            </Typography>{' '}
                            button. This will firstly validate the data, and if
                            valid, sync the record to the remote server.
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
RecordForm.contextType = store;
export default withRouter(RecordForm);
