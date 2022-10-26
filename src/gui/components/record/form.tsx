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

import {Grid, Box, Typography, Divider} from '@mui/material';

import {firstDefinedFromList} from './helpers';
import {
  get_logic_fields,
  get_logic_views,
  update_by_branching_logic,
} from './branchingLogic';

import {ViewComponent} from './view';

import {ActionType} from '../../../context/actions';

import * as ROUTES from '../../../constants/routes';
import {
  ProjectID,
  RecordID,
  RevisionID,
  Annotations,
  Relationship,
} from '../../../datamodel/core';
import {ProjectUIModel} from '../../../datamodel/ui';
import {upsertFAIMSData, getFullRecordData} from '../../../data_storage';
import {getValidationSchemaForViewset} from '../../../data_storage/validation';
import {store} from '../../../context/store';
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
import RecordStepper from './recordStepper';
import {savefieldpersistentSetting} from './fieldPersistentSetting';
import {get_fieldpersistentdata} from '../../../datamodel/fieldpersistent';

import {
  getParentlinkInfo,
  getParentInfo,
  getChildInfo,
} from './relationships/RelatedInformation';

import CircularLoading from '../ui/circular_loading';
import FormButtonGroup, {DevTool} from './formButton';
import UGCReport from './UGCReport';
type RecordFormProps = {
  project_id: ProjectID;
  record_id: RecordID;
  // Might be given in the URL:
  ui_specification: ProjectUIModel;
  conflictfields?: string[] | null;
  handleChangeTab?: Function;
  metaSection?: any;
  isSyncing?: string;
  disabled?: boolean;
  handleSetIsDraftSaving: Function;
  handleSetDraftLastSaved: Function;
  handleSetDraftError: Function;
  setRevision_id?: Function;
  ViewName?: string | null;
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
  // This is set by formChanged() function,
  type_cached: string | null;
  view_cached: string | null;
  activeStep: number;
  revision_cached: string | undefined;
  initialValues: {[fieldName: string]: unknown} | null;
  annotation: {[field_name: string]: Annotations};
  /**
   * Set only by newDraftListener, but this is only non-null
   * for a single render. In that render, a notification will pop up to the user
   * letting them redirect to the draft's URL
   */
  draft_created: string | null;
  description: string | null;
  ugc_comment: string | null;
  relationship: Relationship | null;
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
    if (DEBUG_APP)
      console.debug(
        'initial set up ',
        prevProps.revision_id,
        this.state.revision_cached,
        this.props.revision_id
      );
    if (
      prevProps.project_id !== this.props.project_id ||
      // prevProps.record_id !== this.props.record_id ||
      (prevProps.revision_id !== this.props.revision_id &&
        this.state.revision_cached !== this.props.revision_id) ||
      prevProps.draft_id !== this.props.draft_id //add this to reload the form when user jump back to previous record
    ) {
      if (DEBUG_APP)
        console.debug(
          'initial set up update',
          prevProps.revision_id,
          this.state.revision_cached,
          this.props.revision_id
        );
      // Stop rendering immediately (i.e. go to loading screen immediately)
      this.setState({
        initialValues: null,
        type_cached: null,
        view_cached: null,
        activeStep: 0,
        revision_cached: undefined,
        annotation: {},
        description: null,
        relationship: {},
      });
      // Re-initialize basically everything.
      // if (this.props.revision_id !== undefined)
      this.formChanged(true, this.props.revision_id); // need to check if revision id been passed corrected: after conflict resolved, user save form and user open another form
    }
    // update the viewName if user click link
    if (this.props.ViewName !== this.state.view_cached) {
      if (
        this.props.ViewName !== null &&
        this.props.ViewName !== undefined &&
        this.state.type_cached !== null &&
        this.props.ui_specification.viewsets[
          this.state.type_cached
        ].views.includes(this.props.ViewName)
      )
        this.updateView(this.props.ViewName);
    }
    if (prevState.view_cached !== this.state.view_cached) {
      window.scrollTo(0, 200);
    }
  }

  constructor(props: RecordFormProps & RouteComponentProps) {
    super(props);
    this.draftState = new RecordDraftState(this.props);
    this.state = {
      type_cached: this.props.type ?? null,
      view_cached: null,
      activeStep: 0,
      revision_cached: this.props.revision_id, // pass revision_id when form is opened, need to check if revision id been passed corrected
      initialValues: null,
      draft_created: null,
      annotation: {},
      description: null,
      ugc_comment: null,
      relationship: {},
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
    if (this._isMounted) {
      if (this.state.revision_cached !== null)
        this.formChanged(false, this.state.revision_cached);
      //need to check if revision id been passed corrected
      else this.formChanged(false, this.props.revision_id);
    }
  }

  newDraftListener(draft_id: string) {
    this.setState({draft_created: draft_id});
  }

  saveListener(val: boolean | {}) {
    if (val === true) {
      // Start saving
      this.props.handleSetIsDraftSaving(true);
    } else if (val === false) {
      // Finished saving successfully
      this.props.handleSetIsDraftSaving(false);
      this.props.handleSetDraftLastSaved(new Date());
    } else {
      // Error occurred while saving
      // Heuristically determine a nice user-facing error
      const error_message =
        (val as {message?: string}).message || val.toString();
      if (DEBUG_APP) {
        console.log('saveListener', val);
      }

      this.props.handleSetIsDraftSaving(false);
      this.props.handleSetDraftError(error_message);
      this.context.dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message: 'Could not load previous data: ' + error_message,
          severity: 'warnings',
        },
      });
    }
  }

  async formChanged(
    draft_saving_started_already: boolean,
    revision_id: string | undefined
  ) {
    if (DEBUG_APP) console.debug('check passed revision id', revision_id);
    // const revision_id = this.props.revision_id;
    try {
      let this_type;
      if (this.props.type === undefined) {
        if (revision_id !== undefined) {
          const latest_record = await getFullRecordData(
            this.props.project_id,
            this.props.record_id,
            revision_id
          );
          if (latest_record === null) {
            this.props.handleSetDraftError(
              `Could not find data for record ${this.props.record_id}`
            );
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
          throw Error(`Viewset for type '${this_type}' is missing`);
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
      let viewName = this.props.ui_specification.viewsets[this_type].views[0];
      if (
        this.props.ViewName !== null &&
        this.props.ViewName !== undefined &&
        this.props.ui_specification.viewsets[this_type].views.includes(
          this.props.ViewName
        )
      ) {
        viewName = this.props.ViewName;
      } else if (
        this.state.view_cached !== null &&
        this.state.view_cached !== undefined &&
        this.props.ui_specification.viewsets[this_type].views.includes(
          this.state.view_cached
        )
      ) {
        viewName = this.state.view_cached;
      }
      await this.setState({
        type_cached: this_type,
        view_cached: viewName,
        revision_cached: revision_id,
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
      await this.setInitialValues(revision_id);
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

    try {
      //save the child record when child record been pop
      if (DEBUG_APP)
        console.debug(
          'current revision ID after in formChanged initial',
          this.props.revision_id,
          this.state.revision_cached
        );
      if (
        this.props.revision_id === undefined &&
        this.state.revision_cached === undefined
      ) {
        const location: any = this.props.location;
        if (
          location !== undefined &&
          location.state !== undefined &&
          location.state !== null &&
          location.state.parent_record_id !== undefined &&
          location.state.parent_record_id !== this.props.record_id &&
          this.state.initialValues !== null
        ) {
          this.save(this.state.initialValues, false, false, () =>
            console.log('saved')
          );
        }
      }
    } catch (err: any) {
      console.error('Error save Record ', err);
    }
  }

  async componentWillUnmount() {
    await this.draftState.forceSave();
    //end of update values
    this._isMounted = false;
    for (const timeout_id of this.timeouts) {
      clearTimeout(timeout_id as unknown as Parameters<typeof clearTimeout>[0]);
    }
    this.draftState.stop();
  }

  async setInitialValues(revision_id: string | undefined) {
    /***
     * Formik requires a single object for initialValues, collect these from the
     * (in order high priority to last resort): draft storage, database, ui schema
     */
    if (DEBUG_APP)
      console.debug('current revision id in Initial', this.props.revision_id);
    const fromdb: any =
      revision_id === undefined
        ? {}
        : (await getFullRecordData(
            this.props.project_id,
            this.props.record_id,
            revision_id
          )) || {};
    const database_data = fromdb.data ?? {};
    const database_annotations = fromdb.annotations ?? {};

    const [staged_data, staged_annotations] =
      await this.draftState.getInitialValues();
    if (DEBUG_APP) {
      console.debug('Staged values', staged_data, staged_annotations);
    }

    const fields = getFieldsForViewSet(
      this.props.ui_specification,
      this.requireViewsetName()
    );
    const fieldNames = getFieldNamesFromFields(fields);

    // get value from persistent
    let persistentvalue: any = {};
    if (this.state.type_cached !== null)
      persistentvalue = await get_fieldpersistentdata(
        this.props.project_id,
        this.state.type_cached
      );

    const initialValues: {[key: string]: any} = {
      _id: this.props.record_id!,
      _project_id: this.props.project_id,
      _current_revision_id: revision_id,
    };
    const annotations: {[key: string]: any} = {};

    fieldNames.forEach(fieldName => {
      let initial_value = fields[fieldName]['initialValue'];
      // set value from persistence
      if (
        persistentvalue.data !== undefined &&
        persistentvalue.data[fieldName] !== undefined
      )
        initial_value = persistentvalue.data[fieldName];

      initialValues[fieldName] = firstDefinedFromList([
        staged_data[fieldName],
        database_data[fieldName],
        initial_value,
      ]);
      // set annotation from persistence
      let annotation_value = {annotation: '', uncertainty: false};

      if (
        persistentvalue.annotations !== undefined &&
        persistentvalue.annotations[fieldName] !== undefined
      )
        annotation_value = persistentvalue.annotations[fieldName];
      annotations[fieldName] = firstDefinedFromList([
        staged_annotations[fieldName],
        database_annotations[fieldName],
        annotation_value,
      ]);
    });

    // save child/link information into the parent/linked record when back to upper level
    const {field_id, new_record, is_related} = getChildInfo(
      this.props.location.state,
      this.props.project_id
    );

    if (is_related && new_record !== null) {
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
    const related: Relationship = {};
    let parent = null;
    if (
      this.draftState.data.state !== 'uninitialized' &&
      this.draftState.data.relationship !== undefined
    )
      parent = fromdb.relationship?.parent;
    if (
      parent !== null &&
      parent !== undefined &&
      parent.record_id !== undefined
    )
      related['parent'] = parent;

    let linked = null;
    if (
      this.draftState.data.state !== 'uninitialized' &&
      this.draftState.data.relationship !== undefined
    )
      linked = fromdb.relationship?.linked;
    if (linked !== null && linked !== undefined && linked.length > 0)
      related['linked'] = linked;

    const relationship = getParentInfo(
      this.props.location.state,
      related,
      this.props.record_id
    );
    this.setState({
      initialValues: initialValues,
      annotation: annotations,
      relationship: fromdb.relationship ?? relationship,
    });
    if (DEBUG_APP) console.debug('current revision id', initialValues);
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
      const viewname =
        this.props.ui_specification.viewsets[this.state.type_cached].views[
          activeStepIndex
        ];
      this.setState({
        view_cached: viewname,
        activeStep: activeStepIndex,
      });
    }
  }
  // before save:
  // for link/create new record
  // save child and parent information into record
  // function save:
  // - save doc/record
  // - save persistence data
  // - get new revision id, and set new revision id if user click save and continue

  save(
    values: object,
    is_final_view: boolean,
    is_close: boolean,
    setSubmitting: any
  ) {
    const ui_specification = this.props.ui_specification;
    const viewsetName = this.requireViewsetName();
    //save state into persistent data
    savefieldpersistentSetting(
      this.props.project_id,
      this.state.type_cached,
      values,
      this.state.annotation,
      ui_specification
    );
    if (DEBUG_APP)
      console.debug(
        'current revision id',
        this.state.revision_cached,
        this.props.revision_id
      );
    return (
      getCurrentUserId(this.props.project_id)
        .then(userid => {
          const now = new Date();
          const doc = {
            record_id: this.props.record_id,
            revision_id: this.state.revision_cached ?? null,
            type: this.state.type_cached!,
            data: this.filterValues(values),
            updated_by: userid,
            updated: now,
            annotations: this.state.annotation ?? {},
            field_types: getReturnedTypesForViewSet(
              ui_specification,
              viewsetName
            ),
            ugc_comment: this.state.ugc_comment || '',
            relationship: this.state.relationship ?? {},
          };
          if (DEBUG_APP) {
            console.log(doc);
          }
          return doc;
        })
        .then(doc => {
          return upsertFAIMSData(this.props.project_id, doc).then(
            revision_id => {
              // add to save the information for relationship when form saved,  TODO: need to be defined if it's saved when form been save
              try {
                if (DEBUG_APP)
                  console.debug('get new revision id++++' + revision_id);
                this.setState({revision_cached: revision_id});
                this.formChanged(true, revision_id);
                if (this.props.setRevision_id !== undefined)
                  this.props.setRevision_id(revision_id); //pass the revision id back
              } catch (error) {
                console.error('update child Error', error);
              }
              return is_close
                ? doc.data['hrid' + this.state.type_cached] ??
                    this.props.record_id
                : revision_id; // return revision id for save and continue function
            }
          );
        })
        .then(result => {
          if (DEBUG_APP) {
            console.log(result);
          }
          const message = 'Record successfully saved';
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
          const message = 'Could not save record';
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
          if (is_close) {
            const {state_parent, is_direct} = getParentlinkInfo(
              result,
              this.props.location.state,
              this.props.record_id
            );
            if (is_direct === false) {
              this.props.history.push(ROUTES.NOTEBOOK + this.props.project_id); //update for save and close button
            } else {
              this.props.history.push({
                pathname: ROUTES.NOTEBOOK + state_parent.parent_link,
                state: state_parent,
              });
            }
            window.scrollTo(0, 0);
            // scroll to top of page, seems to be needed on mobile devices
          } else {
            setSubmitting(false);
          }
          return result;
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
    if (DEBUG_APP)
      console.debug(
        'Initial',
        this.state.type_cached,
        this.state.initialValues,
        this.props.ui_specification,
        this.state.view_cached
      );
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
    if (this.state.draft_created !== null) {
      // If a draft was created, that implies this form started from
      // a non draft, so it must have been an existing record (see props
      // as it's got a type {existing record} | {draft already created}
      this.context.dispatch({
        type: ActionType.ADD_CUSTOM_ALERT,
        payload: {
          severity: 'success',
          element: (
            <React.Fragment>
              <Link
                component={RouterLink}
                to={
                  ROUTES.NOTEBOOK +
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
      const viewName = this.requireView();
      const viewsetName = this.requireViewsetName();
      const initialValues = this.requireInitialValues();
      const ui_specification = this.props.ui_specification;
      //fields list and views list could be updated depends on values user choose
      let fieldNames = get_logic_fields(
        this.props.ui_specification,
        initialValues,
        viewName
      );
      let views = get_logic_views(
        this.props.ui_specification,
        viewsetName,
        initialValues
      );
      const validationSchema = getValidationSchemaForViewset(
        ui_specification,
        viewsetName
      );
      //value could be update for branching logic, change to let
      let view_index = views.indexOf(viewName);
      let is_final_view = view_index + 1 === views.length;
      // this expression checks if we have the last element in the viewset array
      const description = this.requireDescription(viewName);
      return (
        <Box>
          {/* {this.state.revision_cached} */}
          {/* remove the tab for edit ---Jira 530 */}
          {/* add padding for form only */}
          <div>
            <Formik
              // enableReinitialize
              initialValues={initialValues}
              validationSchema={validationSchema}
              validateOnMount={true}
              validateOnChange={false}
              validateOnBlur={true}
              onSubmit={(values, {setSubmitting}) => {
                setSubmitting(true);
                return this.save(
                  values,
                  is_final_view,
                  false,
                  setSubmitting
                ).then(result => {
                  return result;
                });
              }}
            >
              {formProps => {
                //ONLY update if the updated field is the controller field
                if (
                  update_by_branching_logic(
                    this.props.ui_specification,
                    formProps.values,
                    true
                  )
                )
                  fieldNames = get_logic_fields(
                    this.props.ui_specification,
                    formProps.values,
                    viewName
                  );
                //ONLY update if the updated field is the controller field
                if (
                  update_by_branching_logic(
                    this.props.ui_specification,
                    formProps.values,
                    false
                  )
                )
                  views = get_logic_views(
                    this.props.ui_specification,
                    viewsetName,
                    formProps.values
                  );
                view_index = views.indexOf(viewName);
                is_final_view = view_index + 1 === views.length;
                this.draftState.renderHook(
                  formProps.values,
                  this.state.annotation,
                  this.state.relationship ?? {}
                );
                return (
                  <Form>
                    {
                      <RecordStepper
                        view_index={view_index}
                        ui_specification={ui_specification}
                        onChangeStepper={this.onChangeStepper}
                        views={views}
                      />
                    }

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

                    <Grid container spacing={2}>
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
                          fieldNames={fieldNames}
                          disabled={this.props.disabled}
                        />
                      </Grid>
                      <br />
                      <FormButtonGroup
                        is_final_view={is_final_view}
                        disabled={this.props.disabled}
                        onChangeStepper={this.onChangeStepper}
                        viewName={viewName}
                        view_index={view_index}
                        formProps={formProps}
                        ui_specification={ui_specification}
                        views={views}
                        handleFormSubmit={(is_close: boolean) => {
                          formProps.setSubmitting(true);
                          this.setTimeout(() => {
                            this.save(
                              formProps.values,
                              is_final_view,
                              is_close,
                              formProps.setSubmitting
                            );
                          }, 500);
                        }}
                      />
                    </Grid>
                    {/* {UGCReport ONLY for the saved record} */}
                    {this.state.revision_cached !== undefined && (
                      <Box mt={3}>
                        <Divider />
                        <UGCReport
                          handleUGCReport={(value: string) => {
                            this.setState({ugc_comment: value});
                            this.save(
                              formProps.values,
                              is_final_view,
                              false,
                              formProps.setSubmitting
                            );
                          }}
                        />
                      </Box>
                    )}
                    <DevTool formProps={formProps} state={this.state} />
                  </Form>
                );
              }}
            </Formik>
          </div>
        </Box>
      );
    } else {
      return (
        <Box sx={{m: 1}}>
          <CircularLoading label={'Loading record data'} />
        </Box>
      );
    }
  }
}
RecordForm.contextType = store;
export default withRouter(RecordForm);
