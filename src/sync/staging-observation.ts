import {FormikValues} from 'formik';
import {getStagedData, setStagedData} from './staging';

const MAX_CONSEQUTIVE_SAVE_ERRORS = 5;

type RelevantProps = {
  project_id: string;
  observation_id: string;
  revision_id: string;
  view_name: string;
  is_fresh: boolean;
};

type StagedData = {
  [fieldName: string]: unknown;
};

//loadedStagedData|stageInterval|staging|touchedFields|lastStagingRev|consequtiveStagingSaveErrors

/**
 * Intermediary between React and Pouch Staging area.
 *
 * Because staging data must be accessable synchronously
 * (due to Formik) this stores a copy of the staging data.
 * (Just for this form, it's not much)
 *
 * Unless you open the same observation on 2 tabs, it's
 * not possible for the pouch to out of sync with this
 */
export class ObservationStagingState {
  // Up-to-date data direct from formik
  // this is kept in-sync with formik. The only reason
  // to duplicate the data is to keep track of which fields
  // have changed.
  data: null | StagedData = null;

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

  // Incrementally increasing revision ID from staging docs.
  // Reset when current observation/project changes
  last_revision: null | string = null;

  /**
   * (Incrementally increasing) revision ID from staging docs
   * Used to avoid collision-avoid lookup before setStagingData
   * Whenever setStagingData is called, save the revision to this.
   */
  rev: null | string = null;

  // +1 every time setStagingData errors out. Set to 0 when it doesn't error.
  errors = 0;

  /**
   * First error in the last sequence of errors to occur.
   */
  last_error: null | {} = null;

  // Null if the form is in an indeterminate state
  // e.g. currentView is not loaded yet.
  props: RelevantProps;

  constructor(relevantProps: RelevantProps) {
    this.props = relevantProps;
  }

  /**
   * A function executed when an observation form renders with the Formik form showing:
   * <Formik>{values => renderHook(values); return (<other elements>)}</Formik>
   *
   * @param values FormikProps.values object, retrieved from the First argument
   *               of the callback to the Formik element's children:
   */
  async renderHook(values: FormikValues) {}

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
   */
  async _fetchData(): Promise<void> {
    const uninterrupted_fetch_sequence = this.fetch_sequence;
    this.data = null;
    try {
      // TODO: Multiple view support
      const data =
        (await getStagedData(this.props.project_id, this.props.view_name, {
          _id: this.props.observation_id,
          _rev: this.props.revision_id,
        })) || {};
      if (this.fetch_sequence !== uninterrupted_fetch_sequence) {
        return; // Assume another fetch has taken control, don't run data_listener errors
      }

      this.touched_fields = new Set(Object.keys(data));
      this.data = data;
      // Resolve any promises waiting for data
      const data_listeners = this.data_listeners;
      this.data_listeners = [];
      data_listeners.forEach(f => f[0].call(this, data));
    } catch (err) {
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
      return with_data(this.data);
    } else {
      return new Promise((resolve, reject) => {
        this.data_listeners.push([resolve, reject]);
      });
    }
  }

  /**
   * Pushes the currently touched values into the staging DB
   */
  async _saveData(): Promise<void> {
    this.is_saving = true;
    let result;
    try {
      result = await setStagedData(
        await this._touchedData(),
        this.last_revision,
        this.props.project_id,
        this.props.view_name,
        {
          _id: this.props.observation_id,
          _rev: this.props.revision_id,
        }
      );

      if (result.ok) {
        this.last_revision = result.rev;
        this.errors = 0;
        this.savedListener();
      }
    } catch (err) {
      this.errors += 1;
      this.last_error = err;
      if (this.errors === MAX_CONSEQUTIVE_SAVE_ERRORS) {
        this.errorListener(this.lastError);
      }
    }
    this.is_saving = false;
  }

  /**
   * Called by setInitialValues, this function retrieves any existing
   * data from the staging area for this current observation/revision
   */
  async getInitialValues(): Promise<StagedData> {
    return this._touchedData();
  }

  /**
   * Set in constructor, called when MAX_CONSEQUTIVE_SAVE_ERRORS reached
   */
  errorListener: (lastError: {}) => unknown;

  /**
   * Set in constructor, called when saving went OK
   */
  savedListener: () => unknown;

  /**
   * Called from ObservationForm.componentDidUpdate,
   * this determines if staging data must be changed/refreshed
   * and does so.
   *
   * Note: To avoid the staged values constantly re-fetching themselves,
   *       only trigger this when any of the following props of your
   *       component changes:
   *           observation_id, revision_id, is_fresh
   *       Or other props that change which data the staging area
   *       should fetch
   *
   * This may trigger a change of state of the ObservationForm
   */
  observationChangeHook(
    observation_id: string,
    revision_id: string,
    is_fresh: boolean
  ) {
    this.data = null;
    this.rev = null;
    this.touchedFields.clear();
  }
}
