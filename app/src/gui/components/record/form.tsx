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

import {
  Annotations,
  generateFAIMSDataID,
  getFirstRecordHead,
  getFullRecordData,
  ProjectID,
  ProjectUIModel,
  RecordID,
  RecordReference,
  Relationship,
  RevisionID,
  upsertFAIMSData,
} from '@faims3/data-model';
import {Alert, Box, Divider, Typography} from '@mui/material';
import {Form, Formik} from 'formik';
import React from 'react';
import {NavigateFunction} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {INDIVIDUAL_NOTEBOOK_ROUTE} from '../../../constants/routes';
import {
  NotificationContext,
  NotificationContextType,
} from '../../../context/popup';
import {selectActiveUser} from '../../../context/slices/authSlice';
import {store} from '../../../context/store';
import {
  currentlyVisibleFields,
  percentComplete,
  requiredFields,
} from '../../../lib/form-utils';
import {getFieldPersistentData} from '../../../local-data/field-persistent';
import {logError} from '../../../logging';
import RecordDraftState from '../../../sync/draft-state';
import {
  getFieldNamesFromFields,
  getFieldsForViewSet,
  getReturnedTypesForViewSet,
} from '../../../uiSpecification';
import {
  getRecordContextFromRecord,
  recomputeDerivedFields,
  ValuesObject,
} from '../../../utils/formUtilities';
import CircularLoading from '../ui/circular_loading';
import {getValidationSchemaForViewset} from '../validation';
import {
  getFieldsMatchingCondition,
  getViewsMatchingCondition,
} from './branchingLogic';
import {savefieldpersistentSetting} from './fieldPersistentSetting';
import FormButtonGroup from './formButton';
import {firstDefinedFromList} from './helpers';
import RecordStepper from './recordStepper';
import {
  generateLocationState,
  generateRelationship,
  getParentLinkInfo,
} from './relationships/RelatedInformation';
import UGCReport from './UGCReport';
import {getUsefulFieldNameFromUiSpec, ViewComponent} from './view';

type RecordFormProps = {
  navigate: NavigateFunction;
  serverId: string;
  project_id: ProjectID;
  record_id: RecordID;
  // Might be given in the URL:
  ui_specification: ProjectUIModel;
  conflictfields?: string[] | null;
  handleChangeTab?: Function;
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

export interface RecordContext {
  // timestamp ms created
  createdTime?: number;
  // First Last name of creator - if any
  createdBy?: string;
}

type RecordFormState = {
  // This is set by formChanged() function,
  type_cached: string | null;
  view_cached: string | null;
  activeStep: number;
  revision_cached: string | undefined;
  initialValues: ValuesObject | null;
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
  visitedSteps: Set<string>;
  isRevisiting: boolean;
  isRecordSubmitted: boolean;
  recordContext: RecordContext;
  lastProcessedValues: ValuesObject | null;
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

class RecordForm extends React.Component<any, RecordFormState> {
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

      // We just reset the type (since the revision ID changed) - so go fetch
      // this again
      await this.identifyRecordType(this.props.revision_id);
      // Then let the form know that things have changed
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
      visitedSteps: new Set<string>(),
      isRevisiting: false,
      isRecordSubmitted: false,
      recordContext: {},
      lastProcessedValues: null,
    };
    this.setState = this.setState.bind(this);
    this.setInitialValues = this.setInitialValues.bind(this);
    this.updateannotation = this.updateannotation.bind(this);
    this.onChangeStepper = this.onChangeStepper.bind(this);
    this.onChangeTab = this.onChangeTab.bind(this);
  }

  // function to update visited steps when needed
  updateVisitedSteps = (stepId: string) => {
    this.setState(prevState => ({
      visitedSteps: new Set(prevState.visitedSteps).add(stepId),
    }));
  };

  // navigation for the section for better UX , ensure section exist in views list.
  handleSectionClick = (section: string) => {
    const index = this.state.views.indexOf(section);

    if (index !== -1) {
      this.onChangeStepper(section, index);
    } else {
      // if section is not found in view list check all aval. sections
      const availableSections = Object.keys(this.props.ui_specification.views);

      if (availableSections.includes(section)) {
        this.onChangeStepper(section, availableSections.indexOf(section));
      } else {
        // log a warning in case its completely invalid.
        console.warn(
          `handleSectionClick: Attempted to navigate to an invalid section: ${section}`
        );
      }
    }
  };

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
        (this.context as NotificationContextType).showError(
          'Could not load previous data: ' + error_message
        );
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
          (this.context as NotificationContextType).showError(
            'Could not load existing record: ' + this.props.record_id
          );
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
      }
    }
    // work out the record type or default it
    if (!(await this.identifyRecordType(revision_id))) {
      (this.context as NotificationContextType).showError(
        'Project is not fully downloaded or not setup correctly'
      );
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

      (this.context as NotificationContextType).showError(
        'Could not load previous data: ' + err.message
      );

      // Show an empty form
      this.setState({
        initialValues: {
          _id: this.props.record_id!,
          _project_id: this.props.project_id,
          _server_id: this.props.serverId,
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
          } else this.save(this.state.initialValues, 'continue', () => {});
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
      const fromdb = revision_id
        ? ((await getFullRecordData(
            this.props.project_id,
            this.props.record_id,
            revision_id
          )) ?? undefined)
        : undefined;

      // data and annotations or nothing
      const database_data = fromdb ? fromdb.data : {};
      const database_annotations = fromdb ? fromdb.annotations : {};

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
        ) {
          initial_value = persistentvalue.data[fieldName];
        }

        // check if record is exisitng.
        const isExistingRecord = !!this.state.revision_cached;

        // Only apply initialValue if it's a new record.
        if (isExistingRecord) {
          initial_value = undefined;
        }

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
        parent = fromdb?.relationship?.parent;

      if (
        parent !== null &&
        parent !== undefined &&
        parent.record_id !== undefined
      ) {
        related['parent'] = parent;
      }

      let linked = null;
      if (
        this.draftState.data.state !== 'uninitialized' &&
        this.draftState.data.relationship !== undefined
      )
        linked = fromdb?.relationship?.linked;
      if (linked !== null && linked !== undefined && linked.length > 0)
        related['linked'] = linked;

      const relationship = generateRelationship(
        this.props.location?.state,
        related,
        this.props.record_id
      );

      // work out the record context
      const context = fromdb
        ? getRecordContextFromRecord({record: fromdb})
        : {};

      this.setState({
        initialValues: initialValues,
        annotation: annotations,
        relationship: fromdb?.relationship ?? relationship,
        // pass in context - this helps compute derived fields
        recordContext: context,
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
    if (viewName === null) {
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
    this.setState(prevState => {
      const {activeStep} = prevState;

      const wasVisitedBefore = prevState.visitedSteps.has(view_name);

      // add to visitedSteps if it has not been visited before
      const updatedVisitedSteps = new Set(prevState.visitedSteps);
      updatedVisitedSteps.add(view_name);

      const isFirstStep = activeStepIndex === 0;

      const isRevisiting =
        wasVisitedBefore || (isFirstStep && activeStep !== activeStepIndex);

      return {
        ...prevState,
        view_cached: view_name,
        activeStep: activeStepIndex,
        visitedSteps: updatedVisitedSteps,
        isRevisiting,
      };
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

  save(values: object, is_close: string, setSubmitting: any) {
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

    // This is a synchronous call to the store - not an ideal to do this... TODO
    // consider rewriting the form as a functional component so we can use hooks
    // properly and consider implications if the active user is no longer
    // defined
    const currentUser = selectActiveUser(store.getState())?.username;

    // TODO no idea how to handle errors appropriately here!
    if (!currentUser) {
      const message =
        'Expected to find current user when interacting with the form, but it was not set. The application does not know which user is trying to interact with the form.';
      console.error(message);
      (this.context as NotificationContextType).showError(message);
      setSubmitting(false);
      return new Promise(() => {
        return;
      });
    }

    const now = new Date();
    const contextInfo = {
      updated_by: currentUser,
      updated: now,
    };

    // merge parent form context into new context - makes the assumption that if
    // the record context doesn't have created person information then we should
    // use the current user as above
    const mergedRecordContext: RecordContext = {
      createdBy: this.state.recordContext.createdBy ?? contextInfo.updated_by,
      createdTime:
        this.state.recordContext.createdTime ??
        // ms timestamp
        contextInfo.updated.getTime(),
    };

    // Now do an in-place update of object values to ensure that we have the
    // latest templated fields which may require on current runtime values
    recomputeDerivedFields({
      values: values,
      context: mergedRecordContext,
      uiSpecification: ui_specification,
    });

    const doc = {
      record_id: this.props.record_id,
      revision_id: this.state.revision_cached ?? null,
      type: this.state.type_cached!,
      data: this.filterValues(values),
      annotations: this.state.annotation ?? {},
      field_types: getReturnedTypesForViewSet(ui_specification, viewsetName),
      ugc_comment: this.state.ugc_comment || '',
      relationship: this.state.relationship ?? {},
      deleted: false,
      ...contextInfo,
    };
    return (
      upsertFAIMSData(this.props.project_id, doc)
        .then(revision_id => {
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
            ? (doc.data['hrid' + this.state.type_cached] ??
                this.props.record_id)
            : revision_id; // return revision id for save and continue function
        })
        // generate a success alert
        .then(hrid => {
          const message = 'Record successfully saved';
          (this.context as NotificationContextType).showSuccess(message);
          return hrid;
        })
        // Could not save record error
        // TODO: this is actually very serious and we should work out how
        // to never get here or provide a good reason if we do
        .catch(err => {
          const message = 'Could not save record';
          logError(`Could not save record: ${JSON.stringify(err)}`);
          (this.context as NotificationContextType).showError(message);
          logError('Unsaved record error:' + err);
        })
        // Clear the current draft area (Possibly after redirecting back to project page)
        .then(async revision_id => {
          this.draftState && (await this.draftState.clear());
          return revision_id;
        })
        // publish and continue editing
        .then(hrid => {
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
                  this.props.navigate(
                    ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
                      this.props.serverId +
                      '/' +
                      this.props.project_id
                  ); //update for save and close button
                  window.scrollTo(0, 0);
                  return hrid;
                  // publish and new record
                } else if (is_close === 'new') {
                  //not child record
                  setSubmitting(false);
                  this.props.navigate(
                    ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
                      this.props.serverId +
                      '/' +
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
                    ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
                      this.props.serverId +
                      '/' +
                      state_parent.parent_link,
                    {state: state_parent}
                  );
                  window.scrollTo(0, 0);
                  return hrid;
                } else if (is_close === 'new') {
                  // for new child record, should save the parent record and pass the location state --TODO
                  const locationState: any = this.props.location.state;
                  setSubmitting(false);
                  this.props.navigate(
                    ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
                      this.props.serverId +
                      '/' +
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
                                this.props.serverId,
                                this.props.project_id,
                                (
                                  location_state.parent_record_id || ''
                                ).toString(),
                                (new_revision_id || '').toString()
                              ).replace(INDIVIDUAL_NOTEBOOK_ROUTE, '');
                            location_state['child_record_id'] = new_record_id;
                            this.props.navigate(
                              ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
                                this.props.serverId +
                                '/' +
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
                          ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
                            this.props.serverId +
                            '/' +
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
                  this.props.navigate(
                    ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
                      this.props.serverId +
                      '/' +
                      this.props.project_id
                  );
                  window.scrollTo(0, 0);
                  return hrid;
                } else if (is_close === 'new') {
                  //not child record
                  setSubmitting(false);
                  this.props.navigate(
                    ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
                      this.props.serverId +
                      '/' +
                      this.props.project_id +
                      ROUTES.RECORD_CREATE +
                      this.state.type_cached
                  );
                  return hrid;
                }
              } else {
                generateLocationState(
                  relationship.parent,
                  this.props.project_id,
                  this.props.serverId
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
                                this.props.serverId,
                                this.props.project_id,
                                (
                                  location_state.parent_record_id || ''
                                ).toString(),
                                (new_revision_id || '').toString()
                              ).replace(INDIVIDUAL_NOTEBOOK_ROUTE, '');
                            location_state['child_record_id'] = new_record_id;
                            this.props.navigate(
                              ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
                                this.props.serverId +
                                '/' +
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
                          ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
                            this.props.serverId +
                            '/' +
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
    return Boolean(
      this.state.type_cached &&
        this.state.initialValues &&
        this.props.ui_specification &&
        this.state.view_cached
    );
  }

  updateannotation(name: string, value: any, type: string) {
    const annotation = this.state.annotation ?? {
      annotation: '',
      uncertainty: false,
    };
    if (annotation !== undefined) {
      if (type === 'uncertainty') {
        annotation[name].uncertainty = value;
      } else if (type === 'annotation') {
        annotation[name].annotation = value;
      }
    }
    this.setState({...this.state, annotation: annotation});
  }

  /**
   * This method filters errors to only those which are visible taking into
   * account a) conditional logic for the individual field b) conditional logic
   * for sections. Returns a filtered error object with the same type.
   *
   * @param errors The object with map from fieldname -> error
   * @param viewsetName The name of the current viewset
   * @param values The values in the form at this time
   * @returns The filtered error object
   */
  filterErrors({
    errors,
    viewsetName,
    values,
  }: {
    errors: {[key: string]: string};
    viewsetName: string;
    values: object;
  }): {[key: string]: string} {
    if (!errors) return {};
    const visibleFields = currentlyVisibleFields({
      uiSpec: this.props.ui_specification,
      values: values,
      viewsetId: viewsetName,
    });

    // Work through the errors and
    return Object.entries(errors).reduce(
      (filtered: {[key: string]: string}, [fieldName, error]) => {
        // Check if field is visible in any view
        const isVisible = visibleFields.includes(fieldName);
        if (isVisible) {
          filtered[fieldName] = error;
        }
        return filtered;
      },
      {}
    );
  }

  render() {
    if (this.isReady()) {
      const viewName = this.requireView();
      const viewsetName = this.requireViewsetName();
      const initialValues = this.requireInitialValues();
      const isRecordSubmitted = !!this.state.revision_cached;

      const ui_specification = this.props.ui_specification;
      const validationSchema = getValidationSchemaForViewset(
        ui_specification,
        viewsetName
      );
      const description = this.requireDescription(viewName);

      return (
        <Box>
          <div>
            <Formik
              initialValues={initialValues}
              // We are manually running the validate function now - if you
              // leave this here this schema validation will take precedence
              // over the manual validate function
              // validationSchema={validationSchema}
              validateOnMount={true}
              validateOnChange={true}
              validateOnBlur={true}
              // This manually runs the validate function which formik triggers
              // validation due to the above conditions, we use the yup
              // validation schema to attempt data validation, filtering errors
              // for only visible fields.
              validate={values => {
                try {
                  // Run the validation function which will check the form
                  // data against the yup schema. This throws exceptions which
                  // represent errors.
                  validationSchema.validateSync(values, {abortEarly: false});

                  // If validation passes, no errors
                  return {};
                } catch (err) {
                  try {
                    const errors = err as {inner: any[]};

                    const processedErrors = errors.inner.reduce(
                      (acc: {[key: string]: string}, error) => {
                        if (error.path) acc[error.path] = error.message;
                        return acc;
                      },
                      {}
                    );
                    return this.filterErrors({
                      errors: processedErrors,
                      values,
                      viewsetName: viewsetName,
                    });
                  } catch (e) {
                    // An exception occurred during error processing - this is a
                    // problem - it might be due to our type casting the error
                    // response, or some error in the filtering logic
                    console.error(
                      'During error processing in the validate loop, an exception \
                      occurred while trying to parse and filter the yup validation \
                      errors. Defaulting to showing no errors to allow user to \
                      proceed. Err: ',
                      e
                    );
                    return {};
                  }
                }
              }}
              onSubmit={(values, {setSubmitting}) => {
                setSubmitting(true);
                return this.save(values, 'continue', setSubmitting);
              }}
            >
              {formProps => {
                // Recompute derived values if something has changed
                const {values, setValues} = formProps;
                // Compare current values with last processed values
                const valuesChanged =
                  JSON.stringify(values) !==
                  JSON.stringify(this.state.lastProcessedValues);

                if (valuesChanged) {
                  // Process the derive fields updates
                  const changed = recomputeDerivedFields({
                    context: this.state.recordContext,
                    values: values,
                    uiSpecification: this.props.ui_specification,
                  });

                  // Only update if processing actually changed something
                  if (changed) {
                    // Update form values
                    setValues(values);
                  }

                  // Store the processed values
                  this.setState({lastProcessedValues: values});
                }

                const layout =
                  this.props.ui_specification.viewsets[viewsetName]?.layout;
                const views = getViewsMatchingCondition(
                  this.props.ui_specification,
                  formProps.values,
                  [],
                  viewsetName,
                  formProps.touched
                );

                // update the progress bar
                this.props.setProgress?.(
                  percentComplete(
                    requiredFields(
                      this.getViewsetName(),
                      this.props.ui_specification,
                      formProps.values
                    ),
                    formProps.values
                  )
                );

                // This fragment of code is critical to saving drafts, it needs
                // to be called here on every render and as a side-effect will
                // save the current draft.
                this.draftState &&
                  this.draftState.renderHook(
                    formProps.values,
                    this.state.annotation,
                    this.state.relationship ?? {}
                  );

                if (layout === 'inline')
                  return (
                    <div>
                      {views.map(view => {
                        const description = this.requireDescription(view);
                        const fieldNames = getFieldsMatchingCondition(
                          this.props.ui_specification,
                          formProps.values,
                          [],
                          view,
                          formProps.touched
                        );

                        return (
                          <div key={`form-${view}`}>
                            <h1>{ui_specification.views[view].label}</h1>
                            <Form>
                              {description !== '' && (
                                <Typography>{description}</Typography>
                              )}

                              <ViewComponent
                                viewName={view}
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
                                hideErrors={true}
                                formErrors={formProps.errors}
                                visitedSteps={this.state.visitedSteps}
                                currentStepId={this.state.view_cached ?? ''}
                                isRevisiting={this.state.isRevisiting}
                                handleSectionClick={this.handleSectionClick}
                              />
                            </Form>
                          </div>
                        );
                      })}
                      {this.state.revision_cached !== undefined && (
                        <Box mt={3}>
                          <Divider />
                          <UGCReport
                            handleUGCReport={(value: string) => {
                              this.setState({ugc_comment: value});
                              this.save(
                                formProps.values,
                                'continue',
                                formProps.setSubmitting
                              );
                            }}
                          />
                        </Box>
                      )}
                      {!formProps.isValid &&
                        Object.keys(formProps.errors).length > 0 && (
                          <Alert severity="error" sx={{mt: 2}}>
                            Form has errors, please scroll up and make changes
                            before submitting.
                            <div>
                              {Object.keys(formProps.errors).map(field => (
                                <React.Fragment key={field}>
                                  <dt>
                                    {getUsefulFieldNameFromUiSpec(
                                      field,
                                      viewName,
                                      ui_specification
                                    )}
                                  </dt>
                                  <dd>{formProps.errors[field] as string}</dd>
                                </React.Fragment>
                              ))}
                            </div>
                          </Alert>
                        )}
                      <FormButtonGroup
                        is_final_view={true}
                        disabled={this.props.disabled}
                        record_type={this.state.type_cached}
                        onChangeStepper={this.onChangeStepper}
                        visitedSteps={this.state.visitedSteps}
                        isRecordSubmitted={isRecordSubmitted}
                        view_index={0}
                        formProps={formProps}
                        ui_specification={ui_specification}
                        views={views}
                        handleFormSubmit={(is_close: string) => {
                          formProps.setSubmitting(true);
                          this.setTimeout(() => {
                            this.save(
                              formProps.values,
                              is_close,
                              formProps.setSubmitting
                            );
                          }, 500);
                        }}
                        layout={layout}
                      />
                      {/* {UGCReport ONLY for the saved record} */}
                      {this.state.revision_cached !== undefined && (
                        <Box mt={3}>
                          <Divider />
                          <UGCReport
                            handleUGCReport={(value: string) => {
                              this.setState({ugc_comment: value});
                              this.save(
                                formProps.values,
                                'continue',
                                formProps.setSubmitting
                              );
                            }}
                          />
                        </Box>
                      )}
                    </div>
                  );

                const fieldNames = getFieldsMatchingCondition(
                  this.props.ui_specification,
                  formProps.values,
                  [],
                  viewName,
                  formProps.touched
                );
                const view_index = views.indexOf(viewName);
                const is_final_view = view_index + 1 === views.length;

                return (
                  <Form>
                    <div
                      style={{
                        padding: this.props.mq_above_md ? '1rem' : '0.2rem',
                      }}
                    >
                      {views.length > 1 && (
                        <RecordStepper
                          view_index={view_index}
                          ui_specification={ui_specification}
                          onChangeStepper={this.onChangeStepper}
                          views={views}
                          formErrors={formProps.errors}
                          visitedSteps={this.state.visitedSteps}
                          isRecordSubmitted={isRecordSubmitted}
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
                        visitedSteps={this.state.visitedSteps}
                        currentStepId={this.state.view_cached ?? ''}
                        isRevisiting={this.state.isRevisiting}
                        handleSectionClick={this.handleSectionClick}
                      />
                      <FormButtonGroup
                        record_type={this.state.type_cached}
                        is_final_view={is_final_view}
                        disabled={this.props.disabled}
                        onChangeStepper={this.onChangeStepper}
                        visitedSteps={this.state.visitedSteps}
                        isRecordSubmitted={isRecordSubmitted}
                        view_index={view_index}
                        formProps={formProps}
                        ui_specification={ui_specification}
                        views={views}
                        handleFormSubmit={(is_close: string) => {
                          formProps.setSubmitting(true);
                          this.setTimeout(() => {
                            this.save(
                              formProps.values,
                              is_close,
                              formProps.setSubmitting
                            );
                          }, 500);
                        }}
                        layout={layout}
                      />
                      {this.state.revision_cached !== undefined && (
                        <Box mt={3}>
                          <Divider />
                          <UGCReport
                            handleUGCReport={(value: string) => {
                              this.setState({ugc_comment: value});
                              this.save(
                                formProps.values,
                                'continue',
                                formProps.setSubmitting
                              );
                            }}
                          />
                        </Box>
                      )}
                    </div>
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
RecordForm.contextType = NotificationContext;
export default RecordForm;
