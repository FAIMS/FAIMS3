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
import {Form, Formik, FormikProps} from 'formik';
import React from 'react';
import {NavigateFunction} from 'react-router-dom';
import {localGetDataDb} from '../../..';
import * as ROUTES from '../../../constants/routes';
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
  LocationState,
  recordIsChildRecord,
} from './relationships/RelatedInformation';
import UGCReport from './UGCReport';
import {getUsefulFieldNameFromUiSpec, ViewComponent} from './view';
import {deleteDraftsForRecord} from '../../../sync/draft-storage';
import {connect, ConnectedProps} from 'react-redux';
import {AppDispatch} from '../../../context/store';

// Import the actions from recordSlice
import {setEdited, setPercent} from '../../../context/slices/recordSlice';
import {isEqual} from 'lodash';

// Define mapDispatchToProps
const mapDispatchToProps = (dispatch: AppDispatch) => {
  return {
    dispatchSetEdited: (edited: boolean) => dispatch(setEdited({edited})),
    dispatchSetPercent: (percent: number) => dispatch(setPercent({percent})),
  };
};

// Create connector
const connector = connect(null, mapDispatchToProps);

type RecordFormProps = ConnectedProps<typeof connector> & {
  navigate: NavigateFunction;
  isExistingRecord: boolean;
  serverId: string;
  project_id: ProjectID;
  record_id: RecordID;
  location: any;
  // Might be given in the URL:
  ui_specification: ProjectUIModel;
  conflictfields?: string[] | null;
  handleChangeTab?: Function;
  isSyncing?: string;
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

// utility type used in the save method for RecordForm
type RecordIdentifiers = {
  record_id: string;
  revision_id: string;
};

// options for the close action on a form
export type FormCloseOptions = 'continue' | 'close' | 'new' | 'cancel';

/*
  Callers of RecordForm

  RecordForm is used in two places:
  - RecordData - the main record editing component
    - project_id, record_id, revision_id, ViewName (null unless following a relation link)
  - DraftEdit - used in creating a new record
    - project_id, record_id, type, draft_id are specified
    - this one works ok
*/

class RecordForm extends React.Component<RecordFormProps, RecordFormState> {
  draftState: RecordDraftState | null = null;
  private formikRef = React.createRef<FormikProps<any>>();

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
    // Handle derived field updates when form values change (moved from render method)
    if (this.formikRef.current) {
      const currentValues = this.formikRef.current.values;
      const valuesChanged = isEqual(
        currentValues,
        this.state.lastProcessedValues
      );

      if (valuesChanged) {
        const changed = recomputeDerivedFields({
          context: this.state.recordContext,
          values: currentValues,
          uiSpecification: this.props.ui_specification,
        });

        if (changed) {
          this.formikRef.current.setValues(currentValues);
        }

        this.setState({lastProcessedValues: currentValues});
      }
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
      this.draftState = new RecordDraftState({
        project_id: this.props.project_id,
        record_id: this.props.record_id,
        revision_id: this.props.revision_id,
        draft_id: this.props.draft_id,
        dispatchSetEdited: this.props.dispatchSetEdited,
      });
    }
    // call formChanged to update the form data, either with
    // the revision_id from state or the one passed in
    let revision_id = this.props.revision_id;
    if (this.state.revision_cached !== null)
      revision_id = this.state.revision_cached;

    await this.identifyRecordType(revision_id);
    await this.formChanged(false, revision_id);

    // If this is an existing record, then mark all sections as visited and validate the form
    if (this.props.isExistingRecord) {
      this.markAllSectionsAsViewed();
    }
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
        const latest_record = await getFullRecordData({
          dataDb: localGetDataDb(this.props.project_id),
          projectId: this.props.project_id,
          recordId: this.props.record_id,
          revisionId: revision_id,
        });

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
        const first_revision_id = await getFirstRecordHead({
          dataDb: localGetDataDb(this.props.project_id),
          recordId: this.props.record_id,
        });
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
        const location = this.props.location;
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
            this.save({
              values: this.state.initialValues,
              closeOption: 'continue',
            });
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
        ? ((await getFullRecordData({
            dataDb: localGetDataDb(this.props.project_id),
            projectId: this.props.project_id,
            recordId: this.props.record_id,
            revisionId: revision_id,
          })) ?? undefined)
        : undefined;

      // data and annotations or nothing
      const database_data = fromdb ? fromdb.data : {};
      const database_annotations = fromdb ? fromdb.annotations : {};

      // this doesn't resolve when the draftState is 'uninitialised'
      // which happens when we redirect here from a child record
      const [staged_data, staged_annotations] =
        this.draftState.data.state === 'uninitialised'
          ? [{}, {}]
          : await this.draftState.getInitialValues();

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
        _server_id: this.props.serverId,
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
        this.draftState.data.state !== 'uninitialised' &&
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
        this.draftState.data.state !== 'uninitialised' &&
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

  /**
   * Filter out internal fields from the values object before saving
   * @param values form values
   * @returns filtered form values
   */
  filterValues(values: object) {
    const internalFields = [
      '_id',
      '_project_id',
      '_current_revision_id',
      '_server_id',
    ];
    const new_values: any = {};
    for (const [k, v] of Object.entries(values)) {
      if (!internalFields.includes(k)) {
        new_values[k] = v;
        if (k[0] === '_') {
          logError(`Including possibly bad key ${k} in record`);
        }
      }
    }
    return new_values;
  }

  checkAllSectionsVisited() {
    const allSections =
      this.props.ui_specification.viewsets[this.getViewsetName()].views;

    allSections.every((section: string) =>
      this.state.visitedSteps.has(section)
    );
  }

  /**
   * Marks all sections as visited and forces revalidation - this allows us to
   * show errors immediately on existing records.
   */
  markAllSectionsAsViewed() {
    // Get all the sections (views)
    const sections =
      this.props.ui_specification.viewsets[this.getViewsetName()].views;

    this.setState(
      prevState => {
        return {...prevState, visitedSteps: new Set(sections)};
      },
      () => {
        if (this.formikRef?.current) {
          this.formikRef.current.validateForm();
        }
      }
    );
  }

  /**
   * Handles navigation between form sections (steps).
   *
   * Tracks visited sections and updates the active step.
   * When all sections are visited, forces Formik to revalidate the form
   * to ensure the "Publish" button is shown correctly.
   *
   * This function supports the `publishButtonBehaviour` setting, which controls
   * when the publish button should be displayed:
   *
   * - `'always'`: The publish button is always visible.
   * - `'visited'`: The publish button is shown only after all sections are visited.
   * - `'noErrors'`: The publish button is shown only after all the errors/required fields of the form as addressed.
   */
  onChangeStepper(view_name: string, activeStepIndex: number) {
    this.setState(
      prevState => {
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
      },
      () => {
        this.checkAllSectionsVisited(); // Check if all sections are visited

        if (
          this.state.visitedSteps.size === this.state.views.length &&
          this.formikRef?.current
        ) {
          this.formikRef.current.validateForm();
        }
      }
    );
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

  /**
   * save a record and navigate to the next location
   *  - cancel: we don't want to save the record, clear the draft and go back to the record list or parent
   *  - continue: setSubmitting re-enabled, so user can save form for the new revision id
   *  - close: - close the current record and return to project list
   *           - close the current record and back to parent record if record created from parent or if record has parent
   *  - new:   - close the current record and create new record when current record has no parent relationship
   *           - when current record has parent: close current record, add new record into parent record, open the new record with parent
   *
   * @param values: an object containing the values from the form to be saved as a new or updated record
   * @param closeOption: the action to perform after save 'continue', 'close', 'new'
   * @param setSubmitting: function to update the submitting state of the form
   */
  save({
    values,
    closeOption,
    setSubmitting = () => {},
  }: {
    values: object;
    closeOption: FormCloseOptions;
    setSubmitting?: (s: boolean) => void;
  }): Promise<RevisionID | void | undefined> {
    const ui_specification = this.props.ui_specification;
    const viewsetName = this.requireViewsetName();

    if (closeOption === 'cancel') {
      return this.handleCancel(ui_specification);
    }

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
      upsertFAIMSData({
        dataDb: localGetDataDb(this.props.project_id),
        record: doc,
      })
        .then(revision_id => {
          // update the component state with the new revision id and notify the parent
          try {
            this.setState({revision_cached: revision_id});
            if (this.props.setRevision_id !== undefined)
              this.props.setRevision_id(revision_id); //pass the revision id back
          } catch (error) {
            logError(error);
          }
          // we need both the revision id and the record id below
          const result: RecordIdentifiers = {
            revision_id,
            record_id: this.props.record_id,
          };
          return result;
        })
        // generate a success alert
        .then(async (ids: RecordIdentifiers) => {
          (this.context as NotificationContextType).showSuccess(
            'Record successfully saved'
          );
          // Clear the current draft state
          this.draftState && (await this.draftState.clear());
          return ids;
        })
        // handle the next step after saving, redirect to the parent, a new record or the record list
        .then((ids: RecordIdentifiers) => {
          if (closeOption === 'continue') {
            setSubmitting(false);
            return ids.revision_id;
          } else
            return this.redirectAfterSave({ids, closeOption, setSubmitting});
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
    );
  }

  /**
   * Bypasses the normal formik checks - passed down to related record selector
   * to force a submission. Overrides the ambiguous save return type by type
   * casting.
   * @returns A revision ID as a promise - this is in the case of the save
   * succeeding!
   */
  async forceSave(formProps: FormikProps<any>): Promise<RevisionID> {
    formProps.setSubmitting(true);
    // TODO improve type hacking!
    return (await this.save({
      values: formProps.values,
      closeOption: 'continue',
      setSubmitting: formProps.setSubmitting,
    })) as RevisionID;
  }

  private handleCancel(ui_specification: ProjectUIModel) {
    const relationState = this.props.location?.state;
    // first case is if we have a parent record, there should be
    // some location state passed in
    if (relationState !== undefined && relationState !== null) {
      // may need to undo a change to the parent record in the case
      // that we are cancelling creation of a child record
      if (relationState.parent_record_id && relationState.field_id) {
        // need to edit the value of field_id in the parent
        // to remove the reference to the child
        this.handleCancelWithRelation({relationState, ui_specification});
      }
    } else {
      const relationship = this.state.relationship;
      if (
        relationship === undefined ||
        relationship === null ||
        relationship.parent === undefined ||
        relationship.parent === null
      ) {
        // there is no relationship, we're good to go
        this.navigateTo(this.getRoute('project'));
      } else {
        generateLocationState(
          relationship.parent,
          this.props.project_id,
          this.props.serverId
        )
          .then(locationState => {
            return this.handleCancelWithRelation({
              ui_specification,
              relationState: locationState.location_state,
            });
          })
          .catch(error => logError(error));
      }
    }
    // remove the draft record
    return deleteDraftsForRecord(this.props.project_id, this.props.record_id);
  }

  /**
   * Deal with the case where we are cancelling out of a form but the form
   * is a child record.  The parent will have been modified before we
   * started to add the child link, so we need to remove it.
   *
   * - relationState - the location state passed in to this route containing context info
   * - ui_specification - the current uiSpec
   */
  private handleCancelWithRelation({
    relationState,
    ui_specification,
  }: {
    relationState: any;
    ui_specification: ProjectUIModel;
  }) {
    const dataDb = localGetDataDb(this.props.project_id);
    getFirstRecordHead({
      dataDb,
      recordId: relationState.parent_record_id,
    }).then(revisionId => {
      getFullRecordData({
        dataDb,
        projectId: this.props.project_id,
        recordId: relationState.parent_record_id,
        revisionId: revisionId,
      }).then(parentRecord => {
        // edit the field value to remove refrence to relationState.child_record
        if (parentRecord) {
          const fieldValue = parentRecord.data[relationState.field_id];
          // remove reference to child record
          // if we have a multiple field, remove from the value list
          // otherwise just reset the value
          let newFieldValue = '';
          if (
            ui_specification.fields[relationState.field_id][
              'component-parameters'
            ].multiple
          ) {
            newFieldValue = fieldValue.filter(
              (r: any) => r.record_id !== relationState.child_record_id
            );
          }
          parentRecord.data[relationState.field_id] = newFieldValue;
          upsertFAIMSData({dataDb, record: parentRecord}).then(revisionId => {
            // now parent link will be out of date as it refers to
            // the old revision so we need a new one
            const revLink = ROUTES.getExistingRecordRoute({
              serverId: this.props.serverId,
              projectId: this.props.project_id,
              recordId: relationState.parent_record_id,
              revisionId,
            });
            this.navigateTo(revLink);
          });
        }
      });
    });
  }

  /**
   * Wrapper around the navigate method - navigate and scroll to top
   * @param destination route to navigate to
   * @param state state to be passed to navigate, optional
   */
  navigateTo(destination: string, state?: any) {
    this.props.navigate(destination, state ? {state} : undefined);
    window.scrollTo(0, 0);
  }

  /**
   * A helper method to generate the navigation routes used after records are saved
   * @param type - type of route we are generating (project, record, create)
   * @param params - parameters needed for the route,
   *          for 'project' this can be empty
   *          for 'create' this should include formType (eg. the value of this.state.type_cached)
   * @returns {string} route path to be passed to navigateTo
   */
  getRoute(
    type: 'project' | 'create',
    params: {
      recordId?: string;
      revisionId?: string;
      formType?: string | null;
    } = {}
  ) {
    const {serverId, project_id} = this.props;
    const base = ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE + serverId + '/' + project_id;

    switch (type) {
      case 'project':
        return base;
      case 'create':
        if (!params.formType)
          throw new Error('Form type required for create route');
        return base + ROUTES.RECORD_CREATE + params.formType;
      default:
        return base;
    }
  }

  /**
   * Handle redirect after a record is saved
   * - navigates to the appropriate place based on the user selection
   *   in closeOption, passing the right context as needed.
   *
   * @param ids - record and revision ids
   * @param closeOption - close or new
   * @param setSubmitting - function to set the submitting state
   * @returns revision id of the recently saved child record
   */
  redirectAfterSave({
    ids,
    closeOption,
    setSubmitting = () => {},
  }: {
    ids: RecordIdentifiers;
    closeOption: FormCloseOptions;
    setSubmitting?: (s: boolean) => void;
  }) {
    const relationState = this.props.location?.state;
    // first case is if we have a parent record, there should be
    // some location state passed in
    if (relationState !== undefined && relationState !== null) {
      if (
        recordIsChildRecord(
          ids.revision_id,
          relationState,
          this.props.record_id
        )
      )
        return this.navigateAfterSaveChild({ids, closeOption, setSubmitting});
      else return this.simpleFinishOrNew({ids, closeOption, setSubmitting});
    } else {
      // here we don't have location state passed in, check the current state
      // to see if we have recorded a relationship
      // when is this set?
      const relationship = this.state.relationship;
      if (
        relationship === undefined ||
        relationship === null ||
        relationship.parent === undefined ||
        relationship.parent === null
      ) {
        return this.simpleFinishOrNew({
          ids,
          closeOption,
          setSubmitting,
        });
      } else {
        generateLocationState(
          relationship.parent,
          this.props.project_id,
          this.props.serverId
        )
          .then(locationState => {
            return this.navigateAfterSaveChild({
              ids,
              closeOption,
              setSubmitting,
              relationData: locationState.location_state,
            });
          })
          .catch(error => logError(error));
      }
    }
  }

  /**
   * Simple case where we just redirect back to the project page or
   * a new record creation page
   *
   * @param ids - record and revision ids
   * @param closeOption - close or new
   * @param setSubmitting - function to set the submitting state
   * @returns revision id of the recently saved child record
   */
  simpleFinishOrNew({
    ids,
    closeOption,
    setSubmitting = () => {},
  }: {
    ids: RecordIdentifiers;
    closeOption: FormCloseOptions;
    setSubmitting?: (s: boolean) => void;
  }) {
    // publish and close
    if (closeOption === 'close') {
      this.navigateTo(this.getRoute('project'));
      return ids.revision_id;
      // publish and new record
    } else if (closeOption === 'new') {
      //not child record
      setSubmitting(false);
      this.navigateTo(
        this.getRoute('create', {formType: this.state.type_cached})
      );
      // finally return the revision id
      return ids.revision_id;
    }
  }

  /**
   * More complex case after saving a child record, may need to
   * modify the parent record's relationship if we're making another child record
   *
   * @param ids - record and revision ids
   * @param closeOption - close or new
   * @param setSubmitting - function to set the submitting state
   * @returns revision id of the recently saved child record
   */
  navigateAfterSaveChild({
    ids,
    closeOption,
    setSubmitting = () => {},
    relationData = null,
  }: {
    ids: RecordIdentifiers;
    closeOption: FormCloseOptions;
    setSubmitting?: (s: boolean) => void;
    relationData?: LocationState | null;
  }) {
    // Use provided relationData or get from props.location.state
    const state_parent = relationData
      ? getParentLinkInfo(ids.revision_id, relationData, this.props.record_id)
      : getParentLinkInfo(
          ids.revision_id,
          this.props.location.state,
          this.props.record_id
        );

    // use either the location state passed in or the location state from props
    const locationState: LocationState =
      relationData || this.props.location.state;

    // this shouldn't happen since we check location.state before we get here
    // but just to be safe we'll handle there being no parent cleanly
    if (state_parent === null) return ids.revision_id;

    if (closeOption === 'close') {
      // redirect back to the parent record or the project page if we don't have a link
      if (state_parent.parent_link)
        this.navigateTo(state_parent.parent_link, state_parent);
      else this.navigateTo(this.getRoute('project'));

      // finally return the revision id
      return ids.revision_id;
    } else if (closeOption === 'new') {
      setSubmitting(false);
      const field_id = locationState.field_id;
      const new_record_id = generateFAIMSDataID();
      const new_child_record = {
        record_id: new_record_id,
        project_id: this.props.project_id,
      };
      if (locationState.parent_record_id) {
        // just to persuade typescript that this isn't undefined
        const parent_record_id = locationState.parent_record_id;
        // here we get the parent record, insert a new child record
        // value into the relation field, save it and then
        // redirect to the route that will actually create
        // the new child record.
        // Insane!

        getFirstRecordHead({
          dataDb: localGetDataDb(this.props.project_id),
          recordId: locationState.parent_record_id,
        }).then(revision_id =>
          getFullRecordData({
            dataDb: localGetDataDb(this.props.project_id),
            projectId: this.props.project_id,
            recordId: parent_record_id,
            revisionId: revision_id,
          }).then(latest_record => {
            const new_doc = latest_record;
            if (new_doc !== null) {
              if (
                field_id &&
                this.props.ui_specification['fields'][field_id][
                  'component-parameters'
                ]['multiple'] === true
              )
                new_doc['data'][field_id] = [
                  ...new_doc['data'][field_id],
                  new_child_record,
                ];
              else if (field_id)
                new_doc['data'][field_id] = [
                  ...new_doc['data'][field_id],
                  new_child_record,
                ];
              upsertFAIMSData({
                dataDb: localGetDataDb(this.props.project_id),
                record: new_doc,
              })
                .then(new_revision_id => {
                  // update location state to point to the parent record
                  locationState['parent_link'] = ROUTES.getExistingRecordRoute({
                    serverId: this.props.serverId,
                    projectId: this.props.project_id,
                    recordId: (locationState.parent_record_id || '').toString(),
                    revisionId: (new_revision_id || '').toString(),
                  });
                  // and add the reference ot the child record id
                  locationState['child_record_id'] = new_record_id;
                  // navigate to the page to create a new record with the updated state
                  this.navigateTo(
                    this.getRoute('create', {formType: this.state.type_cached}),
                    locationState
                  );
                  setSubmitting(false);
                  return revision_id;
                })
                .catch(error => logError(error));
            } else {
              logError('Error saving the parent record, latest record is null');

              // navigate to the page to create a new record with the updated state
              this.navigateTo(
                this.getRoute('create', {formType: this.state.type_cached}),
                locationState
              );
              setSubmitting(false);
              return revision_id;
            }
          })
        );
      }
      // finally return the revision id
      return ids.revision_id;
    }
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
      const views = getViewsMatchingCondition(
        this.props.ui_specification,
        initialValues,
        [],
        viewsetName,
        {}
      );

      // Track visited sections and errors
      const allSectionsVisited = this.state.visitedSteps.size === views.length;

      return (
        <Box>
          <div>
            <Formik
              innerRef={this.formikRef}
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
                return this.save({
                  values,
                  closeOption: 'continue',
                  setSubmitting,
                });
              }}
            >
              {formProps => {
                const hasErrors = Object.keys(formProps.errors).length > 0;
                const publishButtonBehaviour =
                  this.props.ui_specification.viewsets[this.getViewsetName()]
                    ?.publishButtonBehaviour || 'always';

                const showPublishButton =
                  publishButtonBehaviour === 'always' ||
                  (publishButtonBehaviour === 'visited' &&
                    allSectionsVisited) ||
                  (publishButtonBehaviour === 'noErrors' && !hasErrors);

                const layout =
                  this.props.ui_specification.viewsets[viewsetName]?.layout;
                const views = getViewsMatchingCondition(
                  this.props.ui_specification,
                  formProps.values,
                  [],
                  viewsetName,
                  formProps.touched
                );

                this.props.dispatchSetPercent(
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

                // handle submission of the fall - one of three options
                // basically just call save after a short pause
                const handleFormSubmit = (closeOption: FormCloseOptions) => {
                  formProps.setSubmitting(true);
                  this.setTimeout(() => {
                    this.save({
                      values: formProps.values,
                      closeOption,
                      setSubmitting: formProps.setSubmitting,
                    });
                  }, 500);
                };

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
                                hideErrors={true}
                                formErrors={formProps.errors}
                                visitedSteps={this.state.visitedSteps}
                                currentStepId={this.state.view_cached ?? ''}
                                isRevisiting={this.state.isRevisiting}
                                handleSectionClick={this.handleSectionClick}
                                forceSave={async () => {
                                  return await this.forceSave(formProps);
                                }}
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
                              this.save({
                                values: formProps.values,
                                closeOption: 'continue',
                                setSubmitting: formProps.setSubmitting,
                              });
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
                        record_type={this.state.type_cached}
                        onChangeStepper={this.onChangeStepper}
                        visitedSteps={this.state.visitedSteps}
                        isRecordSubmitted={isRecordSubmitted}
                        view_index={0}
                        formProps={formProps}
                        ui_specification={ui_specification}
                        views={views}
                        publishButtonBehaviour={publishButtonBehaviour}
                        showPublishButton={showPublishButton}
                        handleFormSubmit={handleFormSubmit}
                        layout={layout}
                      />
                      {/* {UGCReport ONLY for the saved record} */}
                      {this.state.revision_cached !== undefined && (
                        <Box mt={3}>
                          <Divider />
                          <UGCReport
                            handleUGCReport={(value: string) => {
                              this.setState({ugc_comment: value});
                              this.save({
                                values: formProps.values,
                                closeOption: 'continue',
                                setSubmitting: formProps.setSubmitting,
                              });
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
                        visitedSteps={this.state.visitedSteps}
                        currentStepId={this.state.view_cached ?? ''}
                        isRevisiting={this.state.isRevisiting}
                        handleSectionClick={this.handleSectionClick}
                        forceSave={async () => {
                          return await this.forceSave(formProps);
                        }}
                      />
                      <FormButtonGroup
                        record_type={this.state.type_cached}
                        is_final_view={is_final_view}
                        onChangeStepper={this.onChangeStepper}
                        visitedSteps={this.state.visitedSteps}
                        isRecordSubmitted={isRecordSubmitted}
                        view_index={view_index}
                        formProps={formProps}
                        ui_specification={ui_specification}
                        views={views}
                        publishButtonBehaviour={publishButtonBehaviour}
                        showPublishButton={showPublishButton}
                        handleFormSubmit={handleFormSubmit}
                        layout={layout}
                      />
                      {this.state.revision_cached !== undefined && (
                        <Box mt={3}>
                          <Divider />
                          <UGCReport
                            handleUGCReport={(value: string) => {
                              this.setState({ugc_comment: value});
                              this.save({
                                values: formProps.values,
                                closeOption: 'continue',
                                setSubmitting: formProps.setSubmitting,
                              });
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
export default connector(RecordForm);
