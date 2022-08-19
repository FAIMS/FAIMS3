/*
 * Copyright 2021, 2022 Macquarie University
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
 *   Record/Draft form file
 */

import React from 'react';
import {withRouter} from 'react-router-dom';
import {RouteComponentProps} from 'react-router';
import {Formik, Form} from 'formik';

import {Button, Grid, Box, ButtonGroup, Typography} from '@mui/material';

import CircularProgress from '@mui/material/CircularProgress';
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
import {upsertFAIMSData, getFullRecordData} from '../../../data_storage';
import {getValidationSchemaForViewset} from '../../../data_storage/validation';
import {store} from '../../../store';
import RecordDraftState from '../../../sync/draft-state';
import {
  getFieldsForViewSet,
  getFieldNamesFromFields,
  getReturnedTypesForViewSet,
} from '../../../uiSpecification';
import {DEBUG_APP} from '../../../buildconfig';
import {getCurrentUserId} from '../../../users';
import {Link} from '@mui/material';
import {Link as RouterLink} from 'react-router-dom';
import {grey} from '@mui/material/colors';
import RecordStepper from './recordStepper';
import {savefieldPersistenceSetting} from './fieldPersistenceSetting';
import {get_fieldpersistencedata} from '../../../datamodel/fieldpersistence';
type RecordFormProps = {
  project_id: ProjectID;
  record_id: RecordID;
  // Might be given in the URL:
  view_default?: string;
  ui_specification: ProjectUIModel;
  conflictfields?: string[] | null;
  handleChangeTab?: any;
  metaSection?: any;
  isSyncing?: string;
} & (
  | {
      // When editing existing record, we require the caller to know its revision
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
  error_view: boolean;
  description: string | null;
};

class RecordForm extends React.Component<
  RecordFormProps & RouteComponentProps,
  RecordFormState
> {
  draftState: RecordDraftState;

  // List of timeouts that unmount must cancel
  timeouts: typeof setTimeout[] = [];
  _isMounted = false;

  async componentDidUpdate(
    prevProps: RecordFormProps,
    prevState: RecordFormState
  ) {
    if (
      prevProps.project_id !== this.props.project_id ||
      // prevProps.record_id !== this.props.record_id ||
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
        error_view: false,
        description: null,
      });
      // Re-initialize basically everything.
      this.formChanged(true);
    }
    if (prevState.view_cached !== this.state.view_cached) {
      window.scrollTo(0, 0);
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
      error_view: false,
      description: null,
    };
    this.setState = this.setState.bind(this);
    this.setInitialValues = this.setInitialValues.bind(this);
    this.updateannotation = this.updateannotation.bind(this);
    this.onChangeStepper = this.onChangeStepper.bind(this);
    this.onChangeTab = this.onChangeTab.bind(this);
  }

  componentDidMount() {
    // On mount, draftState.start() must be called, so give this false:
    this._isMounted = true;
    if (this._isMounted) this.formChanged(false);
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
      if (DEBUG_APP) {
        console.log('saveListener', val);
      }

      this.setState({is_saving: false, draftError: error_message});
      this.context.dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message: 'Could not load previous data: ' + error_message,
          severity: 'warnings',
        },
      });
    }
    console.log('is_saving value' + this.state.is_saving);
    console.log('is_saving value called' + val + new Date());
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

      // this.get_view_description(this.props.ui_specification.viewsets[this_type].views[0])

      await this.setState({
        type_cached: this_type,
        view_cached: this.props.ui_specification.viewsets[this_type].views[0],
        revision_cached: this.props.revision_id || null,
        // description:this.requireDescription(this.props.ui_specification.viewsets[this_type].views[0])
      });
    } catch (err: any) {
      console.warn('setUISpec/setLastRev error', err);
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

  async componentWillUnmount() {
    await this.draftState.forceSave();
    this._isMounted = false;
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
    console.log('++++get initial db');
    console.log(fromdb);

    const database_data = fromdb.data ?? {};
    const database_annotations = fromdb.annotations ?? {};

    const [
      staged_data,
      staged_annotations,
    ] = await this.draftState.getInitialValues();
    if (DEBUG_APP) {
      console.debug('Staged values', staged_data, staged_annotations);
    }

    const fields = getFieldsForViewSet(
      this.props.ui_specification,
      this.requireViewsetName()
    );
    const fieldNames = getFieldNamesFromFields(fields);

    // get value from persistence
    let persistencevalue: any = {};
    if (this.state.type_cached !== null)
      persistencevalue = await get_fieldpersistencedata(
        this.props.project_id,
        this.state.type_cached
      );

    const initialValues: {[key: string]: any} = {
      _id: this.props.record_id!,
      _project_id: this.props.project_id,
      _current_revision_id: this.props.revision_id,
    };
    const annotations: {[key: string]: any} = {};

    fieldNames.forEach(fieldName => {
      let intvalue = fields[fieldName]['initialValue'];
      // set value from persistence
      if (
        persistencevalue.data !== undefined &&
        persistencevalue.data[fieldName] !== undefined
      )
        intvalue = persistencevalue.data[fieldName];
      initialValues[fieldName] = firstDefinedFromList([
        staged_data[fieldName],
        database_data[fieldName],
        intvalue,
      ]);
      // set annotation from persistence
      let annotationvalue = {annotation: '', uncertainty: false};
      if (
        persistencevalue.annotations !== undefined &&
        persistencevalue.annotations[fieldName] !== undefined
      )
        annotationvalue = persistencevalue.annotations[fieldName];
      annotations[fieldName] = firstDefinedFromList([
        staged_annotations[fieldName],
        database_annotations[fieldName],
        annotationvalue,
      ]);
    });

    const child_state: any = this.props.location.state;
    if (child_state !== undefined && child_state.record_id !== undefined) {
      //save the sub_record id into initial value
      const field_id = child_state.field_id.replace('?', '');
      const sub_record_id = child_state.record_id;
      const hrid = child_state.hrid ?? sub_record_id;
      const new_record = {
        project_id: this.props.project_id,
        record_id: sub_record_id,
        record_label: hrid,
      };

      if (
        this.props.ui_specification['fields'][field_id]['component-parameters'][
          'multiple'
        ]
      ) {
        let isincluded = false;
        initialValues[field_id].map((r: any) => {
          if (r.record_id === new_record.record_id) {
            isincluded = true;
          }
        });

        if (isincluded === false) {
          initialValues[field_id].push(new_record);
        }
      } else {
        initialValues[field_id] = new_record;
      }
    }

    this.setState({initialValues: initialValues, annotation: annotations});
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

  requireDescription(viewName: string) {
    if (viewName === null || this.props.metaSection === null) {
      console.warn('The description has not been determined yet');
      return '';
    }
    if (DEBUG_APP) {
      console.log('+++++++++++' + viewName);
      console.log(this.props.metaSection);
    }
    if (
      viewName !== null &&
      this.props.metaSection !== undefined &&
      this.props.metaSection[viewName] !== undefined &&
      this.props.metaSection[viewName]['sectiondescription' + viewName] !==
        undefined
    )
      return this.props.metaSection[viewName]['sectiondescription' + viewName];
    return '';
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

  onChangeStepper(view_name: string, activeStepIndex: number) {
    this.setState({
      view_cached: view_name,
      activeStep: activeStepIndex,
    });
  }

  onChangeTab(event: React.ChangeEvent<{}>, newValue: string) {
    const activeStepIndex = parseInt(newValue);
    console.log(activeStepIndex);

    if (this.state.type_cached !== null) {
      console.log(
        this.props.ui_specification.viewsets[this.state.type_cached].views[
          activeStepIndex
        ]
      );
      const viewname = this.props.ui_specification.viewsets[
        this.state.type_cached
      ].views[activeStepIndex];
      this.setState({
        view_cached: viewname,
        activeStep: activeStepIndex,
      });
    }
  }

  save(values: object, is_final_view: boolean) {
    const ui_specification = this.props.ui_specification;
    const viewsetName = this.requireViewsetName();
    //save state into persistence data, this is just for testing, will determine when the value should be daved
    savefieldPersistenceSetting(
      this.props.project_id,
      this.state.type_cached,
      values,
      this.state.annotation,
      ui_specification
    );

    return (
      getCurrentUserId(this.props.project_id)
        .then(userid => {
          const now = new Date();
          const doc = {
            record_id: this.props.record_id,
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
          if (DEBUG_APP) {
            console.log(doc);
          }
          return doc;
        })
        .then(doc => {
          return upsertFAIMSData(this.props.project_id, doc).then(() => {
            return (
              doc.data['hrid' + this.state.type_cached] ?? this.props.record_id
            );
          });
        })
        .then(result => {
          if (DEBUG_APP) {
            console.log(result);
          }
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
          console.log('Saved record', result);
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
          console.error('Failed to save data', err);
        })
        //Clear the current draft area (Possibly after redirecting back to project page)
        .then(result => {
          return this.draftState.clear().then(() => {
            return result;
          });
        })
        .then(result => {
          let redirecturl = this.props.project_id;
          let search = '';
          let state_pa = {};

          if (this.props.revision_id === undefined && is_final_view) {
            // check if last page and draft
            const ori_search = window.location.search;
            const url_split = ori_search.split('&');
            const pathname = window.location.pathname;
            redirecturl =
              this.props.project_id +
              ROUTES.RECORD_CREATE +
              this.state.type_cached;

            if (url_split.length > 1 && ori_search.includes('link=')) {
              const fieldid = url_split[0];

              search = ori_search.replace(
                url_split[0] + '&' + url_split[1] + '&',
                ''
              );
              if (url_split.length > 3 && url_split[0] === url_split[2])
                search = ori_search.replace(
                  url_split[2] + '&' + url_split[3],
                  ''
                );
              const url_split_re = search.split('&');
              if (
                url_split_re.length > 1 &&
                url_split_re[1].replace(
                  'link=/projects/' + this.props.project_id,
                  ''
                ) ===
                  pathname.replace(
                    '/projects/' +
                      pathname.replace('/projects/', '').split('/')[0],
                    ''
                  )
              )
                search = search.replace(
                  url_split_re[0] + '&' + url_split_re[1],
                  ''
                );
              state_pa = {
                field_id: fieldid.replace('?field_id=', ''),
                record_id: this.props.record_id,
                hrid: result,
                parent_link: search,
              };
              if (search !== '')
                redirecturl = url_split[1].replace('link=/projects/', '');
            }
            // scroll to top of page, seems to be needed on mobile devices
          }
          if (search === '') {
            this.props.history.push(ROUTES.PROJECT + this.props.project_id); //update for save and close button
          } else {
            this.props.history.push({
              pathname: ROUTES.PROJECT + redirecturl,
              search: search,
              state: state_pa,
            });
          }
          window.scrollTo(0, 0);
        })
    );
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
    } else {
      if (DEBUG_APP) {
        console.log(name + value);
      }
    }
    this.setState({...this.state, annotation: annotation});
  }

  render() {
    console.log(this.props.conflictfields);
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
      const description = this.requireDescription(viewName);

      return (
        <React.Fragment>
          {/* remove the tab for edit ---Jira 530 */}
          <RecordStepper
            view_index={view_index}
            ui_specification={ui_specification}
            viewsetName={viewsetName}
            activeStep={this.state.activeStep}
            onChangeStepper={this.onChangeStepper}
          />

          {description !== '' && (
            <Box
              bgcolor={'#fafafa'}
              p={3}
              style={{border: '1px #eeeeee dashed'}}
            >
              <Typography>{description}</Typography>
            </Box>
          )}
          <br />
          {/* add padding for form only */}
          <div style={{paddingLeft: '3px', paddingRight: '3px'}}>
            <Formik
              initialValues={initialValues}
              validationSchema={validationSchema}
              validateOnMount={true}
              onSubmit={values => {
                this.setTimeout(() => {
                  // console.log('is saving submitting called');
                  // setSubmitting(false); remove setsubmiting function, after click save, user should not be able to save again
                  this.save(values, is_final_view);
                }, 500);
              }}
            >
              {formProps => {
                // savefieldPersistenceSetting(
                //   this.props.project_id,
                //   this.state.type_cached,
                //   formProps.values,
                //   this.state.annotation,
                //   ui_specification
                // );
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
                      <Grid item sm={12} xs={12}>
                        <ViewComponent
                          viewName={viewName}
                          ui_specification={ui_specification}
                          formProps={formProps}
                          draftState={this.draftState}
                          annotation={this.state.annotation}
                          handerannoattion={this.updateannotation}
                          isSyncing={this.props.isSyncing}
                          conflictfields={this.props.conflictfields}
                          handleChangeTab={this.props.handleChangeTab}
                        />
                        <br />

                        <br />
                        <ButtonGroup
                          color="primary"
                          aria-label="contained primary button group"
                        >
                          {is_final_view ? (
                            <Button
                              type="submit"
                              color={
                                formProps.isSubmitting ? undefined : 'primary'
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
                                ? 'Save and Close'
                                : window.location.search.includes('link=')
                                ? // &&
                                  //   ui_specification.viewsets[viewsetName]
                                  //     .submit_label !== undefined
                                  'Save and Close'
                                : // ui_specification.viewsets[viewsetName]
                                  //     .submit_label
                                  'Save and Close'}
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
                          <ButtonGroup
                            color="primary"
                            aria-label="contained primary button group"
                          >
                            <Button
                              variant="outlined"
                              color="primary"
                              onClick={() => {
                                if (DEBUG_APP) {
                                  console.log(this.state.activeStep);
                                }
                                const stepnum = this.state.activeStep + 1;
                                if (DEBUG_APP) {
                                  console.log(
                                    ui_specification.viewsets[viewsetName]
                                      .views[stepnum]
                                  );
                                }

                                this.setState({
                                  activeStep: stepnum,
                                  view_cached:
                                    ui_specification.viewsets[viewsetName]
                                      .views[stepnum],
                                });
                              }}
                            >
                              {'  '}
                              Continue{' '}
                            </Button>
                            <Button
                              type="submit"
                              color={
                                formProps.isSubmitting ? undefined : 'primary'
                              }
                              variant="outlined"
                              disableElevation
                              disabled={formProps.isSubmitting}
                            >
                              {formProps.isSubmitting
                                ? !(this.props.revision_id === undefined)
                                  ? 'Working...'
                                  : 'Working...'
                                : 'Save and Close'}
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
                        )}
                      </Grid>
                      {String(process.env.REACT_APP_SERVER) ===
                        'developers' && (
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
                              title={
                                'Alpha info: Autosave, validation and syncing'
                              }
                            />
                            <Box bgcolor={grey[200]} p={2}>
                              <p>
                                The data in this form are auto-saved locally
                                within the app every 5 seconds. The data do not
                                need to be valid, and you can return to this
                                page to complete this record on this device at
                                any time.
                              </p>
                              <p>
                                Once you are ready, click the{' '}
                                <Typography variant="button">
                                  <b>
                                    {this.props.revision_id === undefined
                                      ? 'save and close'
                                      : 'update'}
                                  </b>
                                </Typography>{' '}
                                button. This will firstly validate the data, and
                                if valid, sync the record to the remote server.
                              </p>
                            </Box>
                          </Box>
                        </Grid>
                      )}
                    </Grid>
                  </Form>
                );
              }}
            </Formik>
          </div>
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
