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
import {Formik, Form} from 'formik';

import {
  Button,
  Grid,
  Box,
  ButtonGroup,
  Typography,
  Step,
  Stepper,
  StepButton,
  MobileStepper,
} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import grey from '@material-ui/core/colors/grey';
import CircularProgress from '@material-ui/core/CircularProgress';

import {firstDefinedFromList} from './helpers';
import AutoSave from './autosave';
import {ViewComponent} from './view';

import BoxTab from '../ui/boxTab';

import {ActionType} from '../../../actions';
import * as ROUTES from '../../../constants/routes';
import {
  ProjectID,
  RecordID,
  RevisionID,
  Annotations,
} from '../../../datamodel/core';
import {ProjectUIModel} from '../../../datamodel/ui';
import {
  upsertFAIMSData,
  getFullRecordData,
  generateFAIMSDataID,
} from '../../../data_storage';
import {getValidationSchemaForViewset} from '../../../data_storage/validation';
import {store} from '../../../store';
import RecordDraftState from '../../../sync/draft-state';
import {
  getFieldsForViewSet,
  getFieldNamesFromFields,
  getReturnedTypesForViewSet,
} from '../../../uiSpecification';
import {getCurrentUserId} from '../../../users';
import {Link} from '@material-ui/core';
import {Link as RouterLink} from 'react-router-dom';
import {indexOf} from 'lodash';

type RecordFormProps = {
  project_id: ProjectID;
  // Might be given in the URL:
  view_default?: string;
  ui_specification: ProjectUIModel;
} & (
  | {
      // When editing existing record, we require the caller to know its revision
      record_id: RecordID;
      revision_id: RevisionID;
      // The user can view records without editing them, and to facilitate this,
      // having a draft id is optional.
      // In this mode, when the user starts editing, a draft ID is created and
      // stored as state on RecordForm.
      draft_id?: string;

      // To avoid 'type' in this.props, and since in JS when a key is not set,
      // you get back undefined:
      type?: undefined;
    }
  | {
      // When creating a new record,  revision is not yet created.
      // the user had to have already been prompted with viewset/type
      type: string;

      // Draft id, when creating a new record, is created by a redirect
      draft_id: string;

      // To avoid 'revision_id' in this.props, and since in JS when a key is not set,
      // you get back undefined:
      record_id?: undefined;
      revision_id?: undefined;
    }
);

type RecordFormState = {
  draftError: string | null;
  // This is set by formChanged() function,
  type_cached: string | null;
  view_cached: string | null;
  activeStep: number;
  revision_cached: string | null;
  initialValues: {[fieldName: string]: unknown} | null;
  is_saving: boolean;
  last_saved: Date;
  annotation: {[field_name: string]: Annotations};
  /**
   * Set only by newDraftListener, but this is only non-null
   * for a single render. In that render, a notification will pop up to the user
   * letting them redirect to the draft's URL
   */
  draft_created: string | null;
};

class RecordForm extends React.Component<
  RecordFormProps & RouteComponentProps,
  RecordFormState
> {
  draftState: RecordDraftState;

  // List of timeouts that unmount must cancel
  timeouts: typeof setTimeout[] = [];

  async componentDidUpdate(prevProps: RecordFormProps) {
    if (
      prevProps.project_id !== this.props.project_id ||
      prevProps.record_id !== this.props.record_id ||
      (prevProps.revision_id !== this.props.revision_id &&
        this.state.revision_cached !== this.props.revision_id) ||
      prevProps.draft_id !== this.props.draft_id //add this to reload the form when user jump back to previous record
    ) {
      // Stop rendering immediately (i.e. go to loading screen immediately)
      this.setState({
        initialValues: null,
        type_cached: null,
        view_cached: null,
        activeStep: 0,
        revision_cached: null,
        annotation: {},
      });
      // Re-initialize basically everything.
      this.formChanged(true);
    }
  }

  constructor(props: RecordFormProps & RouteComponentProps) {
    super(props);
    this.draftState = new RecordDraftState(this.props);
    this.state = {
      draftError: null,
      type_cached: this.props.type ?? null,
      view_cached: null,
      activeStep: 0,
      revision_cached: null,
      initialValues: null,
      is_saving: false,
      last_saved: new Date(),
      draft_created: null,
      annotation: {},
    };
    this.setState = this.setState.bind(this);
    this.setInitialValues = this.setInitialValues.bind(this);
    this.updateannotation = this.updateannotation.bind(this);
  }

  componentDidMount() {
    // On mount, draftState.start() must be called, so give this false:
    this.formChanged(false);
  }

  newDraftListener(draft_id: string) {
    this.setState({draft_created: draft_id});
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

      this.setState({is_saving: false, draftError: error_message});
      this.context.dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message: 'Could not load previous data: ' + error_message,
          severity: 'warnings',
        },
      });
    }
  }

  async formChanged(draft_saving_started_already: boolean) {
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
            draftError: `Could not find data for record ${this.props.record_id}`,
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

      if (!(this_type in this.props.ui_specification.viewsets)) {
        throw Error(`Viewset for type '${this_type}' is missing`);
      }

      if (!('views' in this.props.ui_specification.viewsets[this_type])) {
        throw Error(
          `Viewset for type '${this_type}' is missing 'views' property'`
        );
      }

      if (this.props.ui_specification.viewsets[this_type].views === []) {
        throw Error(`Viewset for type '${this_type}' has no views`);
      }

      await this.setState({
        type_cached: this_type,
        view_cached: this.props.ui_specification.viewsets[this_type].views[0],
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
      this.requireView();
      // If the draft saving has .start()'d already,
      // The proper way to change the record/revision/etc is this
      // (saveListener is already bound at this point)
      if (draft_saving_started_already) {
        this.draftState.recordChangeHook(this.props, {
          type: this.state.type_cached!,
          field_types: getReturnedTypesForViewSet(
            this.props.ui_specification,
            this.requireViewsetName()
          ),
        });
      } else {
        this.draftState.saveListener = this.saveListener.bind(this);
        this.draftState.newDraftListener = this.newDraftListener.bind(this);
        await this.draftState.start({
          type: this.state.type_cached!,
          field_types: getReturnedTypesForViewSet(
            this.props.ui_specification,
            this.requireViewsetName()
          ),
        });
      }
    } catch (err) {
      console.error('rare draft error', err);
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
    this.draftState.stop();
  }

  async setInitialValues() {
    /***
     * Formik requires a single object for initialValues, collect these from the
     * (in order high priority to last resort): draft storage, database, ui schema
     */
    const fromdb: any =
      this.props.revision_id === undefined
        ? {}
        : (await getFullRecordData(
            this.props.project_id,
            this.props.record_id,
            this.props.revision_id
          )) || {};

    const database_data = fromdb.data ?? {};
    const database_annotations = fromdb.annotations ?? {};

    const [
      staged_data,
      staged_annotations,
    ] = await this.draftState.getInitialValues();
    console.debug('Staged values', staged_data, staged_annotations);

    const fields = getFieldsForViewSet(
      this.props.ui_specification,
      this.requireViewsetName()
    );
    const fieldNames = getFieldNamesFromFields(fields);

    const initialValues: {[key: string]: any} = {
      _id: this.props.record_id!,
      _project_id: this.props.project_id,
      _current_revision_id: this.props.revision_id,
    };
    const annotations: {[key: string]: any} = {};

    fieldNames.forEach(fieldName => {
      initialValues[fieldName] = firstDefinedFromList([
        staged_data[fieldName],
        database_data[fieldName],
        fields[fieldName]['initialValue'],
      ]);
      annotations[fieldName] = firstDefinedFromList([
        staged_annotations[fieldName],
        database_annotations[fieldName],
        {annotation: '', uncertainty: false},
      ]);
    });

    const url_split = window.location.search.split('&');
    if (url_split.length > 1) {
      //save the sub_record id into intitial value
      console.log(url_split);
      const field_id = url_split[0].replace('?field_id=', '');
      const sub_record_id = url_split[1].replace('record_id=', '');
      const new_record = {
        project_id: this.props.project_id,
        record_id: sub_record_id,
        record_label: sub_record_id,
      };
      if (Array.isArray(initialValues[field_id])) {
        let isincluded = false;
        initialValues[field_id].map((r: any) => {
          if (r.record_id === new_record.record_id) {
            isincluded = true;
          }
        });
        if (isincluded === false) initialValues[field_id].push(new_record);
      } else {
        initialValues[field_id] = new_record;
      }
    }

    this.setState({initialValues: initialValues, annotation: annotations});
    console.log(
      this.props.ui_specification.viewsets[this.requireViewsetName()]
        .submit_label
    );
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
      throw Error('The view name has not been determined yet');
    }
    return this.state.view_cached;
  }

  requireViewsetName(): string {
    if (this.state.type_cached === null) {
      throw Error('The viewset name has not been determined yet');
    }
    return this.state.type_cached;
  }

  requireInitialValues() {
    if (this.state.initialValues === null) {
      throw Error('The initial values have not been determined yet');
    }
    return this.state.initialValues;
  }

  filterValues(values: object) {
    const new_values: any = {};
    for (const [k, v] of Object.entries(values)) {
      if (k !== '_id' && k !== '_project_id' && k !== '_current_revision_id') {
        new_values[k] = v;
        if (k[0] === '_') {
          console.error(`Including possibly bad key ${k} in record`);
        }
      }
    }
    return new_values;
  }

  save(values: object) {
    const ui_specification = this.props.ui_specification;
    const viewsetName = this.requireViewsetName();

    getCurrentUserId(this.props.project_id)
      .then(userid => {
        const now = new Date();
        const doc = {
          record_id: this.props.record_id ?? generateFAIMSDataID(),
          revision_id: this.props.revision_id ?? null,
          type: this.state.type_cached!,
          data: this.filterValues(values),
          updated_by: userid,
          updated: now,
          annotations: this.state.annotation ?? {},
          field_types: getReturnedTypesForViewSet(
            ui_specification,
            viewsetName
          ),
        };
        console.log(doc);
        return doc;
      })
      .then(doc => {
        upsertFAIMSData(this.props.project_id, doc);
        return doc.record_id;
      })
      .then(result => {
        console.log(result);
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
        console.error('SaveSave' + result);
        return result;
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
      //Clear the current draft area (Possibly after redirecting back to project page)
      .then(result => {
        this.draftState.clear();
        return result;
      })
      .then(result => {
        // if a new record, redirect to the new record page to allow
        // the user to rapidly add more records
        let redirecturl = this.props.project_id;
        let search = '';
        if (this.props.revision_id === undefined) {
          const url_split = window.location.search.split('&');

          redirecturl =
            this.props.project_id +
            ROUTES.RECORD_CREATE +
            this.state.type_cached;

          if (url_split.length > 1 && url_split[1].includes('link=')) {
            const fieldid = url_split[0];
            let linkurl = url_split[1];
            linkurl = linkurl.replace('link=/projects/', '');

            search = fieldid + '&record_id=' + result;

            redirecturl = linkurl;
          }

          // scroll to top of page, seems to be needed on mobile devices
        }

        if (search === '') {
          this.props.history.push(ROUTES.PROJECT + redirecturl);
        } else {
          this.props.history.push({
            pathname: ROUTES.PROJECT + redirecturl,
            search: search,
          });
        }
        window.scrollTo(0, 0);
      });
  }

  updateView(viewName: string) {
    if (viewName in this.props.ui_specification['views']) {
      this.setState({view_cached: viewName});
      this.forceUpdate();
      // Probably not needed, but we *know* we need to rerender when this
      // changes, so let's be explicit.
    } else {
      throw Error(`No view ${viewName}`);
    }
  }

  isReady(): boolean {
    return (
      this.state.type_cached !== null &&
      this.state.initialValues !== null &&
      this.props.ui_specification !== null &&
      this.state.view_cached !== null
    );
  }

  updateannotation(name: string, value: any, type: string) {
    const annotation = this.state.annotation ?? {};
    if (annotation !== undefined) {
      if (annotation[name] !== undefined) annotation[name][type] = value;
      else {
        annotation[name] = {annotation: '', uncertainty: false};
        annotation[name][type] = value;
      }
    } else console.log(name + value);
    this.setState({...this.state, annotation: annotation});
  }

  render() {
    if (this.state.draft_created !== null) {
      // If a draft was created, that implies this form started from
      // a non draft, so it must have been an existing record (see props
      // as it's got a type {existing record} | {draft already created})
      this.context.dispatch({
        type: ActionType.ADD_CUSTOM_ALERT,
        payload: {
          severity: 'success',
          element: (
            <React.Fragment>
              <Link
                component={RouterLink}
                to={
                  ROUTES.PROJECT +
                  this.props.project_id +
                  ROUTES.RECORD_EXISTING +
                  this.props.record_id! +
                  ROUTES.REVISION +
                  this.props.revision_id! +
                  ROUTES.RECORD_DRAFT +
                  this.state.draft_created
                }
              >
                Created new draft
              </Link>
            </React.Fragment>
          ),
        },
      });
      this.setState({draft_created: null});
    }

    if (this.isReady()) {
      const ui_specification = this.props.ui_specification;
      const viewName = this.requireView();
      const viewsetName = this.requireViewsetName();
      const initialValues = this.requireInitialValues();
      const validationSchema = getValidationSchemaForViewset(
        ui_specification,
        viewsetName
      );
      const view_index = ui_specification.viewsets[viewsetName].views.indexOf(
        viewName
      );
      const is_final_view =
        view_index + 1 === ui_specification.viewsets[viewsetName].views.length;
      // this expression checks if we have the last element in the viewset array

      return (
        <React.Fragment>
          <Box display={{xs: 'none', lg: 'block'}}>
            <Stepper nonLinear activeStep={view_index} alternativeLabel>
              {ui_specification.viewsets[viewsetName].views.map(
                (view_name: string) => (
                  <Step key={view_name}>
                    <StepButton
                      onClick={() => {
                        this.setState({
                          view_cached: view_name,
                          activeStep: indexOf(
                            ui_specification.viewsets[viewsetName].views,
                            view_name
                          ),
                        });
                      }}
                    >
                      {ui_specification.views[view_name].label}
                    </StepButton>
                  </Step>
                )
              )}
            </Stepper>
          </Box>
          <Box display={{xs: 'block', lg: 'none'}}>
            <MobileStepper
              variant="text"
              steps={ui_specification.viewsets[viewsetName].views.length}
              position="static"
              activeStep={this.state.activeStep}
              nextButton={
                <Button
                  size="small"
                  onClick={() => {
                    const stepnum = this.state.activeStep + 1;
                    this.setState({
                      activeStep: stepnum,
                      view_cached:
                        ui_specification.viewsets[viewsetName].views[stepnum],
                    });
                  }}
                  disabled={
                    this.state.activeStep ===
                    ui_specification.viewsets[viewsetName].views.length - 1
                  }
                >
                  Next
                </Button>
              }
              backButton={
                <Button
                  size="small"
                  onClick={() => {
                    const stepnum = this.state.activeStep - 1;
                    this.setState({
                      activeStep: stepnum,
                      view_cached:
                        ui_specification.viewsets[viewsetName].views[stepnum],
                    });
                  }}
                  disabled={this.state.activeStep === 0}
                >
                  Back
                </Button>
              }
            />
            <Typography variant="h5" align="center">
              {
                ui_specification.views[
                  ui_specification.viewsets[viewsetName].views[
                    this.state.activeStep
                  ]
                ].label
              }
            </Typography>
          </Box>

          <Formik
            initialValues={initialValues}
            validationSchema={validationSchema}
            validateOnMount={true}
            onSubmit={(values, {setSubmitting}) => {
              this.setTimeout(() => {
                setSubmitting(false);

                this.save(values);
              }, 500);
            }}
          >
            {formProps => {
              this.draftState.renderHook(
                formProps.values,
                this.state.annotation
              );
              return (
                <Form>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <AutoSave
                        last_saved={this.state.last_saved}
                        is_saving={this.state.is_saving}
                        error={this.state.draftError}
                      />
                    </Grid>
                    <Grid item sm={6} xs={12}>
                      <ViewComponent
                        viewName={viewName}
                        ui_specification={ui_specification}
                        formProps={formProps}
                        draftState={this.draftState}
                        annotation={this.state.annotation}
                        handerannoattion={this.updateannotation}
                      />
                      <br />
                      {formProps.isValid ? (
                        ''
                      ) : (
                        <Alert severity="error">
                          Form has errors, please scroll up or check other tab
                          and make changes before submitting.
                        </Alert>
                      )}
                      <br />
                      <ButtonGroup
                        color="primary"
                        aria-label="contained primary button group"
                      >
                        {is_final_view ? (
                          <Button
                            type="submit"
                            color={
                              formProps.isSubmitting ? 'default' : 'primary'
                            }
                            variant="contained"
                            disableElevation
                            disabled={formProps.isSubmitting}
                          >
                            {formProps.isSubmitting
                              ? !(this.props.revision_id === undefined)
                                ? 'Working...'
                                : 'Working...'
                              : !(this.props.revision_id === undefined)
                              ? 'Update'
                              : window.location.search.includes('link=') &&
                                ui_specification.viewsets[viewsetName]
                                  .submit_label !== undefined
                              ? ui_specification.viewsets[viewsetName]
                                  .submit_label
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
                        ) : (
                          ''
                        )}
                      </ButtonGroup>
                      {this.state.activeStep <
                        ui_specification.viewsets[viewsetName].views.length -
                          1 && (
                        <Button
                          variant="outlined"
                          color="primary"
                          onClick={() => {
                            console.log(this.state.activeStep);
                            const stepnum = this.state.activeStep + 1;
                            console.log(
                              ui_specification.viewsets[viewsetName].views[
                                stepnum
                              ]
                            );

                            this.setState({
                              activeStep: stepnum,
                              view_cached:
                                ui_specification.viewsets[viewsetName].views[
                                  stepnum
                                ],
                            });
                          }}
                        >
                          {'  '}
                          Continue{' '}
                        </Button>
                      )}
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
                        <pre>{JSON.stringify(this.state, null, 2)}</pre>
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
