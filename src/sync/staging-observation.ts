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
 * Filename: staging-observation.ts
 * Description:
 *   Implementation of the staging area, but only:
 *     * Timers
 *     * blur/focus event handlers
 *     * Handling complexities of async saving
 *     * Save & Load functions
 *   This is used from the Record form component,
 *   and relies on the sync/staging.ts file for actual Databases access
 */
import {FormikValues} from 'formik';
import {getStagedData, setStagedData} from './staging';
import {ProjectID, RecordID, RevisionID} from '../datamodel/core';

const MAX_CONSEQUTIVE_SAVE_ERRORS = 5;
const STAGING_SAVE_CYCLE = 5000;

type RelevantProps = {
  project_id: ProjectID;
  // When this is a fresh object, revision_id is null,
  // BUT, Until we support multiple drafts, record_id shouldn't be used if
  // revision_id is null, since that would make a new draft every time
  // a draft is created
  record_id: RecordID;
};

/**
 * Important properties that might not be present
 * until .start() is called. This is mainly used
 * in _fetchData and _saveData
 *
 * revision_id can be null if this is a new record
 */
type LoadableProps = {
  revision_id: RevisionID | null;
  view_name: string;
};

type StagedData = {
  [fieldName: string]: unknown;
};

/**
 * Intermediary between React and Pouch Staging area.
 *
 * Because staging data must be accessable synchronously
 * (due to Formik) this stores a copy of the staging data.
 * (Just for this form, it's not much)
 *
 * Unless you open the same record on 2 tabs, it's
 * not possible for the pouch to out of sync with this
 *
 *
 * This class has an invariant that either _fetchData function is running, or
 * this.data !== null, or this.fetch_error !== null
 * This invariant doesn't hold before start() or after stop()
 */
class RecordStagingState {
  // Up-to-date data direct from formik
  // this is kept in-sync with formik. The only reason
  // to duplicate the data is to keep track of which fields
  // have changed.
  data: null | {fields: StagedData; view_name: string} = null;

  data_listeners: [
    (data: StagedData) => unknown,
    (err: unknown) => unknown
  ][] = [];

  /**
   * Set to true when the touched fields are being iterated on
   * or the staging data is being pushed to Pouch,
   * Set to false once Pouch has returned, or once pouch
   * throws an error
   *
   * This should mean it will be true for a few milliseconds,
   * every 2 seconds (when saving is on)
   */
  is_saving = false;

  /**
   * Return from setInterval, when the staging save is running.
   */
  interval: null | number = null;

  /**
   * Keeps track of any fields that have changed from their initial values
   * This is different from formik's FormikProps.touched, in that it tracks
   * when the values change before the blur event (i.e. listens for onChange AND onBlur)
   * And it loads whatever was previously touched in the staging area.
   * Used for determining what to save to the staging area.
   */
  touched_fields = new Set<string>();

  /**
   * (Incrementally increasing) revision ID from staging docs
   * Reset when current record/project changes
   * Used to avoid collision-avoid lookup before setStagingData
   * Whenever setStagingData is called, save the revision to this.
   */
  last_revision: null | string = null;

  // +1 every time setStagingData errors out. Set to 0 when it doesn't error.
  errors = 0;

  /**
   * First error in the last sequence of errors to occur.
   */
  save_error: null | {} = null;

  /**
   * Last time _fetchData was called, if it produced an error,
   * this is said error.
   */
  fetch_error: null | {} = null;

  // Null if the form is in an indeterminate state
  // e.g. currentView is not loaded yet.
  props: RelevantProps;

  constructor(relevantProps: RelevantProps) {
    this.props = relevantProps;
  }

  /**
   * Starts any timeouts/timers that need to be started,
   * *Starts fetching staging data* (use getInitialValues() after calling this)
   */
  start(loadedProps: LoadableProps) {
    this._fetchData(loadedProps);

    this.interval = window.setInterval(
      this._saveData.bind(this, loadedProps),
      STAGING_SAVE_CYCLE
    );
  }

  /**
   * Stops any pending promises/timeouts, invalidating this class
   * Call this before the owning react component unmounts
   */
  stop() {
    this.fetch_sequence += 1;
    if (this.interval !== null) {
      window.clearInterval(this.interval);
    }
  }

  /**
   * A function executed when an record form renders with the Formik form showing:
   * <Formik>{values => renderHook(values); return (<other elements>)}</Formik>
   *
   * @param values FormikProps.values object, retrieved from the First argument
   *               of the callback to the Formik element's children:
   */
  renderHook(view_name: string, values: FormikValues) {
    if (this.fetch_error === null && this.data !== null) {
      this.data = {view_name: view_name, fields: values};
    }
  }

  /**
   * Creates a listener that is compatible with onChange/onBlur of <Field>s with components
   * that are native HTML components (i.e. components that do call onChange/onBlur and have
   * said listeners on their props)
   *
   * The purpose of this hook is to run an inner handler (from Formik) but also to
   * ensure that any blur/focus event adds the element to the touched elements list.
   *
   * @param innerHandler Formik's handleChange/handleBlur function to call with the event
   * @param fieldName Name of the current field this listener should be for
   * @returns A listener to pass to a <Field> whos component has onChange/onBlur events
   */
  createNativeFieldHook<E extends React.SyntheticEvent<{name: string}>, R>(
    innerHandler: (evt: E) => R,
    fieldName: string
  ): (evt: E) => R {
    return (evt: E): R => {
      const ret = innerHandler(evt);
      this.touched_fields.add(fieldName);
      return ret;
    };
  }

  /**
   * Creates a listener that is compatible with stageValue of <Field>s with components
   * that are custom FAIMS components.
   *
   * The purpose of this hook is to set the value in the formik form, but also to
   * ensure that event adds the element to the touched elements list.
   *
   * @param innerHandler Formik's handleChange/handleBlur function to call with the event
   * @param fieldName Name of the current field this listener should be for
   * @returns A listener to pass to a <Field> whos component has onChange/onBlur events
   */
  createCustomFieldHook(
    /* setFieldValue straight from FormikHelpers<any> */
    setFieldValue: (
      field: string,
      value: any,
      shouldValidate?: boolean | undefined
    ) => void,
    fieldName: string
  ): (value: any) => void {
    return (value: any) => {
      setFieldValue(fieldName, value);
      this.touched_fields.add(fieldName);
    };
  }

  /**
   * Allows the _fetchData to be interrupted.
   * Any future _fetchData calls, or any interruptions
   * just have to increment this value and _fetchData will check
   * it at all its resume points
   */
  fetch_sequence = 0;

  /**
   * Called from within this class, fetches the latest data from the staging area
   * puts it into data and then resolves any promises waiting for said data.
   *
   * This should be called whenever the ID of the staging document changes:
   * this ID is made from the project id, (with listing id), record id and
   * possibly the view (View-specific staging not implemented yet, TBD)
   * So if the project changes, this _fetchData() should be run.
   * This should also be run at construction of this class.
   */
  async _fetchData(loadedProps: LoadableProps): Promise<void> {
    const uninterrupted_fetch_sequence = this.fetch_sequence;
    this.data = null;
    try {
      // TODO: Multiple view support
      const result = await getStagedData(
        this.props.project_id,
        loadedProps.view_name,
        loadedProps.revision_id === null ? null : this.props.record_id,
        loadedProps.revision_id
      );
      this.last_revision = result?._rev || null;

      const data = result?.fields || {};

      if (this.fetch_sequence !== uninterrupted_fetch_sequence) {
        return; // Assume another fetch has taken control, don't run data_listener errors
      }

      this.touched_fields = new Set(Object.keys(data));
      this.data = {view_name: loadedProps.view_name, fields: data};
      // Resolve any promises waiting for data
      const data_listeners = this.data_listeners;
      this.data_listeners = [];
      data_listeners.forEach(f => f[0].call(this, data));
    } catch (err) {
      this.fetch_error = err;
      // Reject any promises waiting for data
      const data_listeners = this.data_listeners;
      this.data_listeners = [];
      data_listeners.forEach(f => f[1].call(this, err));
    }
  }

  /**
   * Called from within this class, waits for data if need be, (assuming
   * fetchData() is running or data is immediately available) then returns
   * the staged data, ONLY fields that are touched
   */
  async _touchedData(): Promise<StagedData> {
    // Function to filter the data
    const with_data = (data: StagedData): StagedData => {
      const filtered_data: StagedData = {};
      this.touched_fields.forEach(
        fieldName => (filtered_data[fieldName] = data[fieldName])
      );
      return filtered_data;
    };

    // Wait for data to exist before returning:
    if (this.data !== null) {
      return with_data(this.data.fields);
    } else if (this.fetch_error !== null) {
      throw this.fetch_error;
    } else {
      return new Promise((resolve, reject) => {
        this.data_listeners.push([resolve, reject]);
      });
    }
  }

  /**
   * Pushes the currently touched values into the staging DB
   *
   * This is awaitable as a normal async function
   */
  async _saveData(loadedProps: LoadableProps): Promise<void> {
    if (this.is_saving) {
      console.warn('Last stage save took longer than ', STAGING_SAVE_CYCLE);
      // Leave thes existing running _saveData function to finish its work
      // Doesn't schedule any more saves to happen
      return;
    }
    this.saveListener(true);
    this.is_saving = true;
    let result;
    try {
      const to_save = await this._touchedData();
      result = await setStagedData(
        to_save,
        this.last_revision,
        this.props.project_id,
        loadedProps.view_name,
        loadedProps.revision_id === null ? null : this.props.record_id,
        loadedProps.revision_id
      );

      if (result.ok) {
        this.last_revision = result.rev;
        this.errors = 0;
        this.saveListener(true);
      } else {
        this.errors += 1;
        this.save_error = Error('Saving to staging returned not OK');
        if (this.errors === MAX_CONSEQUTIVE_SAVE_ERRORS) {
          this.saveListener(this.save_error);
        }
      }
    } catch (err) {
      this.errors += 1;
      this.save_error = err;
      if (this.errors === MAX_CONSEQUTIVE_SAVE_ERRORS) {
        this.saveListener(this.save_error!);
      }
    }
    this.is_saving = false;
  }

  /**
   * Called by setInitialValues, this function retrieves any existing
   * data from the staging area for this current record/revision
   */
  async getInitialValues(): Promise<StagedData> {
    return this._touchedData();
  }

  /**
   * Set in constructor, called when saving starts (true), finishes (false), or
   * (after MAX_CONSEQUTIVE_SAVE_ERRORS reached) errors out ({error_object})
   */
  saveListener: (val: boolean | {}) => unknown = () => {};

  /**
   * Called from RecordForm.componentDidUpdate,
   * this determines if staging data must be changed/refreshed
   * and does so.
   *
   * setInitialValues of your form must be run after this function,
   * i.e. while this runs, initialValues should be non-existant, until
   * this function returns. At which point, you may combine existing data
   * and data from this.getInitialValues() to give to Formik.
   *
   * Note: To avoid the staged values constantly re-fetching themselves,
   *       only trigger this when any of the following props of your
   *       component changes:
   *           record_id, revision_id
   *       Or other props that change which data the staging area
   *       should fetch
   *
   * This may trigger a change of state of the RecordForm
   */
  recordChangeHook(newProps: RelevantProps, loadedProps: LoadableProps) {
    this.data = null;
    this.last_revision = null;
    this.touched_fields.clear();

    this.props = newProps;

    this._fetchData(loadedProps);
  }

  /**
   * Called after save & new button is pressed,
   * This clears the staging area of ALL data
   *
   * This is done for existing observations and new observations
   */
  async clear(loadedProps: LoadableProps) {
    this.touched_fields.clear();
    await this._saveData(loadedProps);
  }
}

export default RecordStagingState;
