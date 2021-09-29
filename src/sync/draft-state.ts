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
 * Filename: draft-state.ts
 * Description:
 *   Implementation of the draft area, but only:
 *     * Timers
 *     * blur/focus event handlers
 *     * Handling complexities of async saving
 *     * Save & Load functions
 *   This is used from the Record form component,
 *   and relies on the sync/draft-storage.ts file for actual Databases access
 */
import {FormikValues} from 'formik';
import {
  deleteStagedData,
  getStagedData,
  newStagedData,
  setStagedData,
} from './draft-storage';
import {ProjectID, RecordID, RevisionID} from '../datamodel/core';
import stable_stringify from 'fast-json-stable-stringify';

const MAX_CONSEQUTIVE_SAVE_ERRORS = 5;
const DRAFT_SAVE_CYCLE = 5000;

type RelevantProps = {
  project_id: ProjectID;
} & (
  | {
      // When editing existing record, we require the caller to know its revision
      record_id: RecordID;
      revision_id: RevisionID;
      // This draft state usually requires a draft to keep
      // track of, BUT if the user is viewing an existing record,
      // A draft ID won't exist until edits are made
      draft_id?: string;
      // Type is required only because that's otherwise another pouchdb lookup,
      // when form.tsx already has type cached.

      // To avoid 'type' in this.props, and since in JS when a key is not set,
      // you get back undefined:
      type?: undefined;
    }
  | {
      // Editing a new record. Type required to create the draft
      draft_id: string;
      type: string;

      // To avoid 'revision_id' in this.props, and since in JS when a key is not set,
      // you get back undefined:
      record_id?: undefined;
      revision_id?: undefined;
    }
);

/**
 * Important properties that might not be present
 * until .start() is called. This is mainly used
 * in _fetchData and _saveData
 */
type LoadableProps = {
  type: string;
};

type StagedData = {
  [fieldName: string]: unknown;
};

/**
 * Intermediary between React and Pouch Draft storage.
 *
 * Because draft data must be accessable synchronously
 * (due to Formik) this stores a copy of the draft data.
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
class RecordDraftState {
  data:
    | {
        state: 'uninitialized';
      }
    | {
        state: 'unedited';
        // Once this.data moves out of this state into 'edited', _fetchData will
        // fetch the fields
        type: string;
        // In order to know when to save edits, the renderHook is called by
        // the form component. But we don't know, at this point, what initial
        // data we should compare the Formik values against, so the first call
        // to renderHook establishes said data here:
        // (A more correct way to do this, to avoid possibly loosing a bit of data
        // in a certain execution, would be to pass down initialValues from
        // the form component, but that's more complicated.)
        fields: StagedData | null;
      }
    | {
        state: 'edited';
        // Up-to-date data direct from draft storage
        // this is kept in-sync with formik. The only reason
        // to duplicate the data is to keep track of which fields
        // have changed.
        // and this is only up to date with fields in the current view
        // (view_fields)
        fields: StagedData;
        type: string;
        // Same as props.draft_id, EXCEPT this can also be set to non-null
        // when changes are made to a revision that hasn't been edited yet
        //
        // The reason this is a promise is that there is a state of draft-state
        // where the draft is being created (by pouch local), which is unfortunately
        // async, so the promise serves as a way to wait for the draft to be
        // created
        draft_id: Promise<string>;
      } = {state: 'uninitialized'};

  // NOTE: When data === 'unedited_existing', then draft_id is null.
  // When draft_id is null, data may be null or 'unedited_existing', depending
  // on if _fetchData has been run

  data_listeners: [
    (data: StagedData) => unknown,
    (err: unknown) => unknown
  ][] = [];

  /**
   * Set to true when the touched fields are being iterated on
   * or the draft data is being pushed to Pouch,
   * Set to false once Pouch has returned, or once pouch
   * throws an error
   *
   * This should mean it will be true for a few milliseconds,
   * every 2 seconds (when saving is on)
   */
  is_saving = false;

  /**
   * Return from setInterval, when the draft save is running.
   */
  interval: null | number = null;

  /**
   * Keeps track of any fields that have changed from their initial values
   * This is different from formik's FormikProps.touched, in that it tracks
   * when the values change before the blur event (i.e. listens for onChange AND onBlur)
   * And it loads whatever was previously touched in the draft storage.
   * Used for determining what to save to the draft storage.
   */
  touched_fields = new Set<string>();

  /**
   * (Incrementally increasing) revision ID from draft docs
   * Reset when current record/project changes
   * Used to avoid collision-avoid lookup before setDraftData
   * Whenever setDraftData is called, save the revision to this.
   */
  last_revision: null | string = null;

  // +1 every time setDraftData errors out. Set to 0 when it doesn't error.
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
   * *Starts fetching draft data* (use getInitialValues() after calling this)
   */
  start(loadedProps: LoadableProps) {
    this._fetchData(loadedProps);

    this.interval = window.setInterval(
      this._saveData.bind(this),
      DRAFT_SAVE_CYCLE
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
  renderHook(values: FormikValues) {
    if (this.fetch_error === null && this.data.state !== 'uninitialized') {
      // determine newly touched fields
      // This is usually done by createNativeFieldHook's onBlur event being
      // triggered before any code gets to renderHook(), but
      // the diffing, here, is what Formik creators intended us to do,
      // and ensures that user-implemented components that forget to use
      // createCustomFieldHook's return (instead using setFieldValue) can still
      // have touched fields
      //
      // This diffing should replace createNativeFieldHook/createCustomFieldHook

      // TODO: Figure out why autoincrement components trigger the comparison,
      // hence causing all forms with an autoincrement component to always
      // create new drafts when viewing them.

      if (this.data.fields === null) {
        // 1st call to renderHook establishes the 'default' initial data
        this.data.fields = values;
      }

      // Don't compare things that are in the staging area
      // but are completley absent from the form
      // as those components are just not in the current view
      // Only compare fields in the current view:
      for (const field in values) {
        // Formik & Pouch should give us comparable JSON objects.
        // As long as it differs at the top level, we say it's touched
        // BUT we don't want things like {} to not equal another {} (or [] != [])
        // So we use JSON stable stringify to compare
        //
        // undefined in gives undefined out. Which is prefectly fine
        if (
          stable_stringify(this.data.fields?.[field]) !==
          stable_stringify(values?.[field])
        ) {
          this.touched_fields.add(field);
        }
      }

      if (this.touched_fields.size === 0) {
        return;
      }

      // If anything changed, we create the draft:
      if (this.data.state === 'unedited') {
        this.data = {
          ...this.data,
          state: 'edited',
          fields: values,
          draft_id: newStagedData(
            this.props.project_id,
            // Since this.data is in an 'unedited' state, we know FOR SURE
            // that revision_id and record_id were passed in.
            {
              revision_id: this.props.revision_id!,
              record_id: this.props.record_id!,
            },
            this.data.type
          ),
        };
        this.data.draft_id.then(new_draft_id => {
          if (this.data.state === 'edited') {
            this.data = {
              ...this.data,
              draft_id: Promise.resolve(new_draft_id),
            };
            // If anyone is listening for when a new draft is created
            // they probably expect the draft to be saved, so save it
            // then call that listener:

            setStagedData(new_draft_id, this.data.fields).then(() => {
              if (this.newDraftListener !== null) {
                this.newDraftListener(new_draft_id);
              }
            });
          }
          // this.data, in an impossibly rare execution, might be set to
          // something other than 'edited' (possibly when clear() is called
          // before resuming). In which case we don't want to set more data.
        });
      } else {
        // Edit existing document by setting data
        this.data = {
          ...this.data,
          fields: {...this.data.fields, ...values},
        };
      }
    } else if (this.data === null) {
      console.debug(
        "This state shouldn't be encountered: Somehow, draft-storages renderHook " +
          'was called before draft finished loading data from the local ' +
          'draft Pouch. The dev should have waited for the draft data to ' +
          'finish loading (you can wait on initialValues) before even ' +
          'attempting to render components/call renderHook'
      );
    }
  }

  /**
   * Called if this state goes from unedited => edited
   * (i.e. the user changed a value in the form)
   */
  newDraftListener: null | ((draft_id: string) => unknown) = null;

  /**
   * Allows the _fetchData to be interrupted.
   * Any future _fetchData calls, or any interruptions
   * just have to increment this value and _fetchData will check
   * it at all its resume points
   */
  fetch_sequence = 0;

  /**
   * Called from within this class, fetches the latest data from the draft storage
   * puts it into data and then resolves any promises waiting for said data.
   *
   * This should be called whenever the ID of the draft document changes:
   * this ID is made from the project id, (with listing id), record id and
   * possibly the view (View-specific draft not implemented yet, TBD)
   * So if the project changes, this _fetchData() should be run.
   * This should also be run at construction of this class.
   */
  async _fetchData(loadedprops: LoadableProps): Promise<void> {
    const uninterrupted_fetch_sequence = this.fetch_sequence;
    this.data = {state: 'uninitialized'};

    if (this.props.draft_id !== undefined) {
      // Editing an existing draft
      try {
        const result = await getStagedData(this.props.draft_id);

        if (this.fetch_sequence !== uninterrupted_fetch_sequence) {
          return; // Assume another fetch has taken control, don't run data_listener errors
        }

        this.last_revision = result._rev;
        this.touched_fields = new Set(Object.keys(result.fields));
        this.data = {
          state: 'edited',
          fields: result.fields,
          type: result.type,
          draft_id: Promise.resolve(this.props.draft_id),
        };
        // Resolve any promises waiting for data
        const data_listeners = this.data_listeners;
        this.data_listeners = [];
        data_listeners.forEach(f => f[0].call(this, result.fields));
      } catch (err: any) {
        this.fetch_error = err;
        // Reject any promises waiting for data
        const data_listeners = this.data_listeners;
        this.data_listeners = [];
        data_listeners.forEach(f => f[1].call(this, err));
      }
    } else {
      // No draft exists yet
      // Drafts are created (And types needed) when
      this.data = {state: 'unedited', type: loadedprops.type, fields: null};
      // this.draft_id hasn't needed to be created yet, keep as null
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
    if (this.data.state === 'edited') {
      return with_data(this.data.fields);
    } else if (this.data.state === 'unedited') {
      return with_data({});
    } else if (this.fetch_error !== null) {
      throw this.fetch_error;
    } else {
      return new Promise((resolve, reject) => {
        this.data_listeners.push([resolve, reject]);
      });
    }
  }

  /**
   * Pushes the currently touched values into the draft DB
   *
   * This is awaitable as a normal async function
   */
  async _saveData(): Promise<void> {
    if (this.is_saving) {
      console.warn('Last stage save took longer than ', DRAFT_SAVE_CYCLE);
      // Leave thes existing running _saveData function to finish its work
      // Doesn't schedule any more saves to happen
      return;
    }
    this.saveListener(true);
    this.is_saving = true;
    let result;
    try {
      const to_save = await this._touchedData();
      if (this.data.state !== 'edited') {
        // Nothing to save yet, probably the user hasn't touched an
        // existing record
        return;
      }
      result = await setStagedData(await this.data.draft_id, to_save);

      if (result.ok) {
        this.last_revision = result.rev;
        this.errors = 0;
        this.saveListener(true);
      } else {
        this.errors += 1;
        this.save_error = Error('Saving to draft returned not OK');
        if (this.errors === MAX_CONSEQUTIVE_SAVE_ERRORS) {
          this.saveListener(this.save_error);
        }
      }
    } catch (err: any) {
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
   * data from the draft storage for this current record/revision
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
   * this determines if draft data must be changed/refreshed
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
   *       Or other props that change which data the draft storage
   *       should fetch
   *
   * This may trigger a change of state of the RecordForm
   */
  recordChangeHook(newProps: RelevantProps, loadedProps: LoadableProps) {
    this.data = {state: 'uninitialized'};
    this.last_revision = null;
    this.touched_fields.clear();

    this.props = newProps;

    this._fetchData(loadedProps);
  }

  /**
   * Called after save & new button is pressed,
   * This deletes the draft from the draft database
   *
   * This is done for existing observations and new observations, and therefore
   * reverts RecordDraftState to as if it was given draft_id === null
   * (Even for editing new drafts)
   */
  async clear() {
    if (this.data.state === 'edited') {
      await deleteStagedData(await this.data.draft_id, this.last_revision);
    }

    this.data = {state: 'uninitialized'};
    this.touched_fields.clear();

    this.last_revision = null;
  }
}

export default RecordDraftState;
