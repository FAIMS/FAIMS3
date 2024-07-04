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
import {Formik, Form} from 'formik';

import {Grid, Box, Typography, Divider} from '@mui/material';

import {firstDefinedFromList} from './helpers';
import {
  getViewsMatchingCondition,
  getFieldsMatchingCondition,
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
  RecordReference,
} from 'faims3-datamodel';
import {
  ProjectUIModel,
  upsertFAIMSData,
  getFullRecordData,
} from 'faims3-datamodel';
import {getValidationSchemaForViewset} from '../validation';
import {store} from '../../../context/store';
import RecordDraftState from '../../../sync/draft-state';
import {
  getFieldsForViewSet,
  getFieldNamesFromFields,
  getReturnedTypesForViewSet,
} from '../../../uiSpecification';
import {DEBUG_APP} from '../../../buildconfig';
import {getCurrentUserId} from '../../../users';
import {NavigateFunction} from 'react-router-dom';
import RecordStepper from './recordStepper';
import {savefieldpersistentSetting} from './fieldPersistentSetting';
import {getFieldPersistentData} from '../../../local-data/field-persistent';

import {
  getParentLinkInfo,
  generateRelationship,
  generateLocationState,
} from './relationships/RelatedInformation';

import CircularLoading from '../ui/circular_loading';
import FormButtonGroup, {DevTool} from './formButton';
import UGCReport from './UGCReport';
import {generateFAIMSDataID, getFirstRecordHead} from 'faims3-datamodel';
import {logError} from '../../../logging';
//import {RouteComponentProps} from 'react-router';
type RecordFormProps = {
  navigate: NavigateFunction;
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
  draftLastSaved?: null | Date;
  mq_above_md?: boolean;
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
      // type is the viewSet name - the name of the form that allows editing of this record
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
  fieldNames: string[];
  views: string[];
};

/*
  Callers of RecordForm

  RecordForm is used in two places:
  - RecordData - the main record editing component
    - project_id, record_id, revision_id, ViewName (null unless following a relation link)
  - DraftEdit - used in creating a new record
    - project_id, record_id, type, draft_id are specified
    - this one works ok
*/

class RecordForm extends React.Component<
  // RecordFormProps & RouteComponentProps,
  // RecordFormState
  any,
  RecordFormState
> {
  draftState: RecordDraftState | null = null;

  // List of timeouts that unmount must cancel
  timeouts: (typeof setTimeout)[] = [];

  async componentDidUpdate(
    prevProps: RecordFormProps,
    prevState: RecordFormState
  ) {
    // check whether the record has changed in the update
    // if it has, we need to reload everything

    // need to check if revision id been passed corrected:
    //   after conflict resolved, user save form and
    //   user open another form
    if (
      prevProps.project_id !== this.props.project_id ||
      // prevProps.record_id !== this.props.record_id ||
      (prevProps.revision_id !== this.props.revision_id &&
        this.state.revision_cached !== this.props.revision_id) ||
      prevProps.draft_id !== this.props.draft_id // add this to reload the form when user jump back to previous record
    ) {
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
      this.formChanged(true, this.props.revision_id);
    }
    // if viewName is specified it is the result of the user clicking
    // on a relation link within a record
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

  constructor(props: RecordFormProps) {
    super(props);

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
      fieldNames: [],
      views: [],
    };
    this.setState = this.setState.bind(this);
    this.setInitialValues = this.setInitialValues.bind(this);
    this.updateannotation = this.updateannotation.bind(this);
    this.onChangeStepper = this.onChangeStepper.bind(this);
    this.onChangeTab = this.onChangeTab.bind(this);
  }

  async componentDidMount() {
    // moved from constructor since it has a side-effect of setting up a global timer
    if (!this.draftState) {
      this.draftState = new RecordDraftState(this.props as any);
    }
    // call formChanged to update the form data, either with
    // the revision_id from state or the one passed in
    let revision_id = this.props.revision_id;
    if (this.state.revision_cached !== null)
      revision_id = this.state.revision_cached;

    await this.identifyRecordType(revision_id);
    await this.formChanged(false, revision_id);
  }

  async componentWillUnmount() {
    this.draftState && (await this.draftState.forceSaveAndStop());
    //end of update values
    for (const timeout_id of this.timeouts) {
      clearTimeout(timeout_id as unknown as Parameters<typeof clearTimeout>[0]);
    }
  }

  newDraftListener(draft_id: string) {
    this.setState({draft_created: draft_id});
  }

  // callback function for draftStorage that will be called with:
  // true - if saving is in progress
  // false - if saving finished ok
  // an error if something went wrong with saving the draft
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

      if (error_message === 'no changes') {
        //for existing record with no new draft created, set saving false and reset the last draft time
        this.props.handleSetIsDraftSaving(false);
        if (
          this.props.draftLastSaved === null ||
          this.props.draftLastSaved === undefined
        )
          this.props.handleSetDraftLastSaved(new Date());
      } else {
        this.props.handleSetIsDraftSaving(false);
        this.props.handleSetDraftError(error_message);
        (this.context as any).dispatch({
          type: ActionType.ADD_ALERT,
          payload: {
            message: 'Could not load previous data: ' + error_message,
            severity: 'warning',
          },
        });
      }
    }
  }

  // identifyRecordType - work out what type of record this is
  //   specifically the type (viewSetName) and viewName
  //   return true if we found them and updated the State
  //          false otherwise
  async identifyRecordType(revision_id: string | undefined): Promise<boolean> {
    // bail early if we already know the type and viewname
    if (this.state.view_cached && this.state.type_cached) {
      return true;
    }

    let viewSetName;
    if (this.props.type === undefined) {
      if (revision_id !== undefined) {
        // get the record so we can see the type
        const latest_record = await getFullRecordData(
          this.props.project_id,
          this.props.record_id,
          revision_id
        );

        if (latest_record === null) {
          this.props.handleSetDraftError(
            `Could not find data for record ${this.props.record_id}`
          );
          (this.context as any).dispatch({
            type: ActionType.ADD_ALERT,
            payload: {
              message:
                'Could not load existing record: ' + this.props.record_id,
              severity: 'warning',
            },
          });
          return false;
        } else {
          viewSetName = latest_record.type;
        }
      } else {
        // can't identify the record so
        return false;
      }
    } else {
      viewSetName = this.props.type;
    }

    // validate the type we've found
    if (!(viewSetName in this.props.ui_specification.viewsets)) {
      return false;
    }

    if (!('views' in this.props.ui_specification.viewsets[viewSetName])) {
      return false;
    }

    if (this.props.ui_specification.viewsets[viewSetName].views.length === 0) {
      return false;
      // throw Error(`Viewset for type '${viewSetName}' has no views`);
    }

    // now retrieve the view name from the uiSpec
    const viewSet = this.props.ui_specification.viewsets[viewSetName];
    // default to the first view
    let viewName = viewSet.views[0];

    // override with the viewName from props or the cached value
    // if they are present
    if (
      this.props.ViewName !== null &&
      this.props.ViewName !== undefined &&
      viewSet.views.includes(this.props.ViewName)
    ) {
      viewName = this.props.ViewName;
    } else if (
      this.state.view_cached !== null &&
      this.state.view_cached !== undefined &&
      viewSet.views.includes(this.state.view_cached)
    ) {
      viewName = this.state.view_cached;
    }
    this.setState({
      type_cached: viewSetName,
      view_cached: viewName,
      revision_cached: revision_id, // TODO: not sure this should be set here...
    });
    return true;
  }

  async formChanged(
    draft_saving_started_already: boolean,
    passed_revision_id: string | undefined
  ) {
    let revision_id = passed_revision_id;
    if (revision_id === undefined) {
      try {
        // for new draft but saved record, get the revision instead of using undefined
        const first_revision_id = await getFirstRecordHead(
          this.props.project_id,
          this.props.record_id
        );
        revision_id = first_revision_id;
      } catch (error) {
        // here if there was no existing record with this id above
        // so we ca't update revision_id so it is still undefined
        if (DEBUG_APP) console.debug('new record', this.props.record_id);
      }
    }
    // work out the record type or default it
    if (!(await this.identifyRecordType(revision_id))) {
      (this.context as any).dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message: 'Project is not fully downloaded or not setup correctly',
          severity: 'error',
        },
      });
      // This form cannot be shown at all. No recovery except go back to project.
      this.props.navigate(-1);
      return;
    }

    if (this.draftState && this.getViewName() && this.getViewsetName()) {
      // If the draft saving has .start()'d already,
      // The proper way to change the record/revision/etc is this
      // (saveListener is already bound at this point)
      if (draft_saving_started_already) {
        this.draftState.recordChangeHook(this.props as any, {
          type: this.state.type_cached!,
          field_types: getReturnedTypesForViewSet(
            this.props.ui_specification,
            this.getViewsetName()
          ),
        });
      } else {
        this.draftState.saveListener = this.saveListener.bind(this);
        this.draftState.newDraftListener = this.newDraftListener.bind(this);
        this.draftState.start({
          type: this.state.type_cached!,
          field_types: getReturnedTypesForViewSet(
            this.props.ui_specification,
            this.getViewsetName()
          ),
        });
      }
    }

    try {
      await this.setInitialValues(revision_id);
    } catch (err: any) {
      logError(err);
      (this.context as any).dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message: 'Could not load previous data: ' + err.message,
          severity: 'warning',
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
          if (
            location.state.child_record_id !== undefined &&
            location.state.child_record_id !== this.props.record_id
          ) {
            //child_record_id should always be current record_id, otherwise there would be an issue
            logError(
              `Error in formChanged, data not saved, child_record_id is not record_id ${this.props.record_id} != ${location.state.child_record_id}`
            );
          } else
            this.save(this.state.initialValues, false, 'continue', () => {});
        }
      }
    } catch (err: any) {
      logError(err);
    }
  }

  /**
   * Initialise the values in this record editing form from the database
   * @param revision_id - record revision identifier
   */
  async setInitialValues(revision_id: string | undefined) {
    // can't do this if draftState hasn't been initialised
    if (this.draftState) {
      /***
       * Formik requires a single object for initialValues, collect these from the
       * (in order high priority to last resort): draft storage, database, ui schema
       */
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

      const fields = getFieldsForViewSet(
        this.props.ui_specification,
        this.requireViewsetName()
      );
      const fieldNames = getFieldNamesFromFields(fields);

      // get value from persistent
      let persistentvalue: any = {};
      if (this.state.type_cached !== null)
        persistentvalue = await getFieldPersistentData(
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

      // save child/link information into the parent/linked
      // record when back to upper level
      // Code here moved from getChildInfo in RelatedInformation.tsx

      const child_state = this.props.location?.state;
      const is_related = child_state?.record_id && child_state?.field_id;

      if (is_related) {
        const field_id = child_state?.field_id.replace('?', '') || '';

        const new_record: RecordReference = {
          project_id: this.props.project_id,
          record_id: child_state.record_id,
          record_label: child_state.hrid ?? child_state.record_id,
          relation_type_vocabPair:
            child_state.relation_type_vocabPair ?? undefined,
        };

        if (
          this.props.ui_specification['fields'][field_id][
            'component-parameters'
          ]['multiple']
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

      const relationship = generateRelationship(
        this.props.location?.state,
        related,
        this.props.record_id
      );
      initialValues['fieldNames'] = [];
      initialValues['views'] = [];
      this.setState({
        initialValues: initialValues,
        annotation: annotations,
        relationship: fromdb.relationship ?? relationship,
      });
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

  requireView(): string {
    //It always throw Error because this.state.view_cached === null by default
    //And it block unit tests for this file
    if (this.state.view_cached === null) {
      throw Error('The cached view has not been determined yet');
    }
    return this.state.view_cached;
  }

  getViewName(): string {
    return this.state.view_cached || '';
  }

  getViewsetName(): string {
    return this.state.type_cached || '';
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
    // get the description from the view if it's there
    if (
      viewName !== null &&
      this.props.ui_specification.views[viewName] !== undefined &&
      this.props.ui_specification.views[viewName].description !== undefined
    ) {
      return this.props.ui_specification.views[viewName].description;
    }

    // backwards compatibility - look in the metadata section
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
          logError(`Including possibly bad key ${k} in record`);
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

    if (this.state.type_cached !== null) {
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
  // - clear the draft
  // after save: direct user to different path
  // - - publish and continue: setSubmitting re-enabled, so user can save form for the new revision id
  // - - publish and close: - close the current record and return to project list
  //                     - close the current record and back to parent record if record created from parent or if record has parent
  // - - publish and new:  - close the current record and create new record when current record has no parent relationship
  //                    - when current record has parent: close current record, add new record into parent record, open the new record with parent

  save(
    values: object,
    is_final_view: boolean,
    is_close: string,
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
    return (
      getCurrentUserId(this.props.project_id)
        .then(userid => {
          // prepare the record for saving
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
            deleted: false,
          };
          return doc;
        })
        .then(doc => {
          // store the record
          return upsertFAIMSData(this.props.project_id, doc).then(
            revision_id => {
              // update the component state with the new revision id and notify the parent
              try {
                this.setState({revision_cached: revision_id});
                // SC. Removing this call since it prevents deletion of the draft
                // later on (draftState.clear())
                // by changing the draft state to 'uninitialised'
                //
                //this.formChanged(true, revision_id);
                if (this.props.setRevision_id !== undefined)
                  this.props.setRevision_id(revision_id); //pass the revision id back
              } catch (error) {
                logError(error);
              }
              return is_close === 'close'
                ? doc.data['hrid' + this.state.type_cached] ??
                    this.props.record_id
                : revision_id; // return revision id for save and continue function
            }
          );
        })
        .then(hrid => {
          const message = 'Record successfully saved';
          (this.context as any).dispatch({
            type: ActionType.ADD_ALERT,
            payload: {
              message: message,
              severity: 'success',
            },
          });
          return hrid;
        })
        .catch(err => {
          // TODO: this is actually very serious and we should work out how
          // to never get here or provide a good reason if we do
          const message = 'Could not save record';
          console.error('Could not save record:', err);
          (this.context as any).dispatch({
            type: ActionType.ADD_ALERT,
            payload: {
              message: message,
              severity: 'error',
            },
          });
          logError('Unsaved record error:' + err);
        })
        //Clear the current draft area (Possibly after redirecting back to project page)
        .then(async revision_id => {
          this.draftState && (await this.draftState.clear());
          return revision_id;
        })
        .then(hrid => {
          // publish and continue editing
          if (is_close === 'continue') {
            setSubmitting(false);
            return hrid;
          } else {
            const relationState = this.props.location?.state;
            if (relationState !== undefined && relationState !== null) {
              const {state_parent, is_direct} = getParentLinkInfo(
                hrid,
                this.props.location.state,
                this.props.record_id
              );
              // if this is not a child record then is_direct will be false
              if (is_direct === false) {
                // publish and close
                if (is_close === 'close') {
                  this.props.navigate(ROUTES.NOTEBOOK + this.props.project_id); //update for save and close button
                  window.scrollTo(0, 0);
                  return hrid;
                  // publish and new record
                } else if (is_close === 'new') {
                  //not child record
                  setSubmitting(false);
                  this.props.navigate(
                    ROUTES.NOTEBOOK +
                      this.props.project_id +
                      ROUTES.RECORD_CREATE +
                      this.state.type_cached
                  );
                  window.scrollTo(0, 0);
                  return hrid;
                }
              } else {
                // or we're dealing with a child record
                if (is_close === 'close') {
                  this.props.navigate(
                    ROUTES.NOTEBOOK + state_parent.parent_link,
                    {state: state_parent}
                  );
                  window.scrollTo(0, 0);
                  return hrid;
                } else if (is_close === 'new') {
                  // for new child record, should save the parent record and pass the location state --TODO
                  const locationState: any = this.props.location.state;
                  setSubmitting(false);
                  this.props.navigate(
                    ROUTES.NOTEBOOK +
                      this.props.project_id +
                      ROUTES.RECORD_CREATE +
                      this.state.type_cached,
                    {state: this.props.location.state}
                  );
                  const field_id = locationState.field_id;
                  const new_record_id = generateFAIMSDataID();
                  const new_child_record = {
                    record_id: new_record_id,
                    project_id: this.props.project_id,
                  };
                  getFirstRecordHead(
                    this.props.project_id,
                    locationState.parent_record_id
                  ).then(revision_id =>
                    getFullRecordData(
                      this.props.project_id,
                      locationState.parent_record_id,
                      revision_id
                    ).then(latest_record => {
                      const new_doc = latest_record;
                      if (new_doc !== null) {
                        if (
                          this.props.ui_specification['fields'][field_id][
                            'component-parameters'
                          ]['multiple'] === true
                        )
                          new_doc['data'][field_id] = [
                            ...new_doc['data'][field_id],
                            new_child_record,
                          ];
                        else
                          new_doc['data'][field_id] = [
                            ...new_doc['data'][field_id],
                            new_child_record,
                          ];
                        upsertFAIMSData(this.props.project_id, new_doc)
                          .then(new_revision_id => {
                            const location_state: any = locationState;
                            location_state['parent_link'] =
                              ROUTES.getRecordRoute(
                                this.props.project_id,
                                (
                                  location_state.parent_record_id || ''
                                ).toString(),
                                (new_revision_id || '').toString()
                              ).replace('/notebooks/', '');
                            location_state['child_record_id'] = new_record_id;
                            this.props.navigate(
                              ROUTES.NOTEBOOK +
                                this.props.project_id +
                                ROUTES.RECORD_CREATE +
                                this.state.type_cached,
                              {state: location_state}
                            );
                            setSubmitting(false);
                            window.scrollTo(0, 0);
                            return revision_id;
                          })
                          .catch(error => logError(error));
                      } else {
                        logError(
                          'Error saving the parent record, latest record is null'
                        );
                        this.props.navigate(
                          ROUTES.NOTEBOOK +
                            this.props.project_id +
                            ROUTES.RECORD_CREATE +
                            this.state.type_cached,
                          {state: locationState.location_state}
                        );
                        setSubmitting(false);
                        window.scrollTo(0, 0);
                        return revision_id;
                      }
                    })
                  );
                  return hrid;
                }
              }
            } else {
              const relationship = this.state.relationship;
              if (
                relationship === undefined ||
                relationship === null ||
                relationship.parent === undefined ||
                relationship.parent === null
              ) {
                if (is_close === 'close') {
                  this.props.navigate(ROUTES.NOTEBOOK + this.props.project_id);
                  window.scrollTo(0, 0);
                  return hrid;
                } else if (is_close === 'new') {
                  //not child record
                  setSubmitting(false);
                  this.props.navigate(
                    ROUTES.NOTEBOOK +
                      this.props.project_id +
                      ROUTES.RECORD_CREATE +
                      this.state.type_cached
                  );
                  return hrid;
                }
              } else {
                generateLocationState(
                  relationship.parent,
                  this.props.project_id
                )
                  .then(locationState => {
                    if (is_close === 'close') {
                      this.props.navigate(
                        locationState.location_state.parent_link
                      );
                      window.scrollTo(0, 0);
                      return hrid;
                    } else if (is_close === 'new') {
                      // for new child record, should save the parent record and pass the location state --TODO
                      // update parent information

                      const new_doc = locationState.latest_record;
                      const field_id = locationState.location_state.field_id;
                      const new_record_id = generateFAIMSDataID();
                      const new_child_record = {
                        record_id: new_record_id,
                        project_id: this.props.project_id,
                        // record_label:new_record_id
                        // relation_type_vocabPair: [],
                      };
                      if (new_doc !== null) {
                        if (
                          this.props.ui_specification['fields'][field_id][
                            'component-parameters'
                          ]['multiple'] === true
                        )
                          new_doc['data'][field_id] = [
                            ...new_doc['data'][field_id],
                            new_child_record,
                          ];
                        else
                          new_doc['data'][field_id] = [
                            ...new_doc['data'][field_id],
                            new_child_record,
                          ];
                        upsertFAIMSData(this.props.project_id, new_doc)
                          .then(new_revision_id => {
                            const location_state: any =
                              locationState.location_state;
                            location_state['parent_link'] =
                              ROUTES.getRecordRoute(
                                this.props.project_id,
                                (
                                  location_state.parent_record_id || ''
                                ).toString(),
                                (new_revision_id || '').toString()
                              ).replace('/notebooks/', '');
                            location_state['child_record_id'] = new_record_id;
                            this.props.navigate(
                              ROUTES.NOTEBOOK +
                                this.props.project_id +
                                ROUTES.RECORD_CREATE +
                                this.state.type_cached,
                              {state: location_state}
                            );
                            setSubmitting(false);
                            window.scrollTo(0, 0);
                            return hrid;
                          })
                          .catch(error => logError(error));
                      } else {
                        logError(
                          'Error to save the parent record from child relationship, latest record is null'
                        );
                        this.props.navigate(
                          ROUTES.NOTEBOOK +
                            this.props.project_id +
                            ROUTES.RECORD_CREATE +
                            this.state.type_cached,
                          {state: locationState.location_state}
                        );
                        setSubmitting(false);
                        window.scrollTo(0, 0);
                      }
                    }
                  })
                  .catch(error => logError(error));
              }
            }
          }
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
    // if (DEBUG_APP) {
    //   if (!this.state.type_cached)
    //     console.debug('isReady false because type_cached is false');
    //   if (!this.state.initialValues)
    //     console.debug('isReady false because initialValues is false');
    //   if (!this.props.ui_specification)
    //     console.debug('isReady false because ui_specification is false');
    //   if (!this.state.view_cached)
    //     console.debug('isReady false because view_cached is false');
    // }
    return Boolean(
      this.state.type_cached &&
        this.state.initialValues &&
        this.props.ui_specification &&
        this.state.view_cached
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
    }
    this.setState({...this.state, annotation: annotation});
  }

  render() {
    // we can't do this here because it changes state and forces a redraw
    // if (this.state.draft_created !== null) {
    //   // If a draft was created, that implies this form started from
    //   // a non draft, so it must have been an existing record (see props
    //   // as it's got a type {existing record} | {draft already created}
    //   (this.context as any).dispatch({
    //     type: ActionType.ADD_CUSTOM_ALERT,
    //     payload: {
    //       severity: 'success',
    //       element: (
    //         <React.Fragment>
    //           <Link
    //             component={RouterLink}
    //             to={
    //               ROUTES.NOTEBOOK +
    //               this.props.project_id +
    //               ROUTES.RECORD_EXISTING +
    //               this.props.record_id! +
    //               ROUTES.REVISION +
    //               this.props.revision_id! +
    //               ROUTES.RECORD_DRAFT +
    //               this.state.draft_created
    //             }
    //           >
    //             Created new draft
    //           </Link>
    //         </React.Fragment>
    //       ),
    //     },
    //   });
    //   this.setState({draft_created: null});
    // }

    if (this.isReady()) {
      const viewName = this.requireView();
      const viewsetName = this.requireViewsetName();
      const initialValues = this.requireInitialValues();
      const ui_specification = this.props.ui_specification;
      //fields list and views list could be updated depends on values user choose
      let fieldNames: string[] = [];
      let views: string[] = [];
      const validationSchema = getValidationSchemaForViewset(
        ui_specification,
        viewsetName
      );
      let view_index = 0;
      let is_final_view = true;
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
                  'continue',
                  setSubmitting
                ).then(result => {
                  return result;
                });
              }}
            >
              {formProps => {
                //ONLY update if the updated field is the controller field
                fieldNames = getFieldsMatchingCondition(
                  this.props.ui_specification,
                  formProps.values,
                  fieldNames,
                  viewName,
                  formProps.touched
                );
                views = getViewsMatchingCondition(
                  this.props.ui_specification,
                  formProps.values,
                  views,
                  viewsetName,
                  formProps.touched
                );
                view_index = views.indexOf(viewName);
                is_final_view = view_index + 1 === views.length;
                this.draftState &&
                  this.draftState.renderHook(
                    formProps.values,
                    this.state.annotation,
                    this.state.relationship ?? {}
                  );
                return (
                  <Form>
                    {views.length > 1 && (
                      <RecordStepper
                        view_index={view_index}
                        ui_specification={ui_specification}
                        onChangeStepper={this.onChangeStepper}
                        views={views}
                      />
                    )}

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
                          handleAnnotation={this.updateannotation}
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
                        mq_above_md={this.props.mq_above_md}
                        handleFormSubmit={(is_close: string) => {
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
                              'continue',
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
        <Box data-testid="circular-loading" sx={{m: 1}}>
          <CircularLoading label={'Loading record data'} />
        </Box>
      );
    }
  }
}
RecordForm.contextType = store;
export default RecordForm;
