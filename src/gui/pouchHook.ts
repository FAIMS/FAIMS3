import {useEffect, useState} from 'react';
import {add_initial_listener} from '../sync/event-handler-registration';
import stable_stringify from 'json-stable-stringify';

/**
 * Given that an event has just happened from EventEmitter,
 * this fetches & translates any state data for a DBTracker to keep track of
 *
 * This may also be called if the user requests state for a given Param and
 * there is nothing yet known for the given state, and eager_load is defined
 *
 * unknown[] args: These may not be consumed by the EventStateMapping, but these
 * are the arguments directly passed from the initializeEvents emission
 *
 * State: State that is kept track of by DBTracker
 */
export type EventStateMapping<Params extends unknown[], State> = (
  ...params: [...Params, ...any[]]
) => State | Promise<State>;

/**
 * Given an event from the EventEmitter, determines what type
 * of params it has (for a given DBTracker)
 */
export type EventParamsMapping<Params extends unknown[]> = (
  ...event_args: any[]
) => Params[] | Promise<Params[]>;

export const default_filter = () => true;

export type TrackPoint<P extends unknown[], S> =
  | [
      string, // Event name to listen on initializeEvents
      // When an event of said name triggers, this function determines if
      // it applies to a given parameterset that's being listened for
      EventStateMapping<P, S>,
      EventParamsMapping<P>
    ]
  | [
      string, // Event name to listen on initializeEvents
      // For when DB events on the above event listeners are indiscriminate,
      // We don't want to bother extracting the list of updates separately
      // from the list of states: Just give a new Mappings of States
      EventStateMapping<P, S>
    ];

type AttachedPoint = (...args: unknown[]) => void;

export class FullState<S> {
  // Only one of these 3 is defined at a time
  error?: {};
  value?: S;
  loading?: 'reload' | 'initial';
  constructor(
    full_state:
      | {err: {}; state?: undefined; loading?: undefined}
      | {err?: undefined; state: S; loading?: undefined}
      | {err?: undefined; state?: undefined; loading: boolean}
  ) {
    if (full_state.err !== undefined) {
      this.error = full_state.err;
    } else if (full_state.state !== undefined) {
      this.value = full_state.state;
    } else {
      this.loading = full_state.loading ? 'reload' : 'initial';
    }
  }

  /**
   * fmap function for the FullState functor: If this FullState isn't in a
   * loading/error state, this returns a new FullState with the value mapped
   * by the given f function
   * @param f Maps the interior state value. Called 0 or 1 time.
   * @returns A new FullState, possibly with same err/loading state, or T from f
   */
  map<T>(f: (state: S) => T): FullState<T> {
    if (this.value !== undefined) {
      return new FullState({state: f(this.value)});
    } else {
      // Create a COPY of this, so that we don't have a FullState<T> and FullState<S>
      // referring to the same object.
      if (this.error !== undefined) {
        return new FullState({err: this.error});
      } else {
        return new FullState({loading: this.loading === 'reload'});
      }
    }
  }

  catch(...fs: ((error: {}) => {} | void)[]): FullState<S> {
    if (this.error !== undefined) {
      // Convert all errors in the fs conversion funcs list, recursively
      if (fs === []) {
        // Base case: No conversion whatsoever, just a copy
        return new FullState({err: this.error});
      } else {
        // Recursive case: Convert using the first function given.
        return new FullState<S>({err: fs[0](this.error) || {}}).catch(
          ...fs.slice(1)
        );
      }
    } else if (this.value !== undefined) {
      return new FullState({state: this.value});
    } else {
      return new FullState({loading: this.loading === 'reload'});
    }
  }

  /**
   * Calls only 1 of the 3 given functions, depending on what state this
   * FullState is in.
   * useful for producing 3 different React Components based on the state
   * @param map_state Branch executed when this FullState is NOT errored/loading
   * @param map_error Branch executed when this FullState is in an error state
   * @param map_loading Branch executed when this FullState is still loading
   */
  match<T, U, V>(
    map_state: (state: S) => T,
    map_error: (error: {}) => U,
    map_loading: (loading: 'reload' | 'initial') => V
  ): T | U | V {
    if (this.value !== undefined) {
      return map_state(this.value);
    } else if (this.error !== undefined) {
      return map_error(this.error);
    } else {
      return map_loading(this.loading!);
    }
  }
}

export type StateListener<S> = (state: FullState<S>) => void;

export type GlobalListener<P extends unknown[], S> = (
  ...args:
    | [params: P, state: FullState<S>]
    // params might be undefined if a global error occurred.
    | [params: undefined, error: {}]
) => void;

/**
 * Concept:
 *   An instance for every updatable state that needs to be kept track of.
 *   An updatable state is data derived from a PouchDB document or set of
 *   documents, which may change.
 *   The PouchDB emits change events, and those change events are filtered
 *   through this class, converting them to the form expected, and emits to
 *   any 'listeners'.
 *   Importantly, the PouchDB's raw data is broken up into a key-value of
 *   'Params' (key) and 'State' (value), which may be updated at separate times.
 *   _A Listener only listens for changes to state on 1 Param_
 *
 * store_all mode:
 *   Sometimes _all_ state must be kept track of, even though no one uses it
 *   yet, because some listener might come around later and need state.
 *
 *   So when store_all is set true, all state is kept whenever updates come
 *   through from the PouchDB.
 *
 * non-store_all mode:
 *   In the use case that a listener only needs to listen for updates, not to
 *   know the state, but just to keep up to date, store_all can be set to false
 *   to prevent unused memory from staying around
 *
 * Loading:
 *   When you try to get a state for a Param, there is a union (FullState<S>)
 *   that is spit out. This is also given out to listeners when updates occur.
 *
 *   Once a Promise<State> is running for a given Param, (i.e. an update event
 *   from the DB came in recently) state for that Param is {loading: true}
 *
 *   However, if no events have ever been emitted for a given Param, OR (in
 *   non-store_all mode) if they have been emitted before addListener(param) was
 *   called and, its state is in {loading:false}
 *
 * Errors:
 *   Errors are handled from a call to EventStateMapping(params) is passed to
 *   any listeners listening to params, as {err: error caught}
 *
 *   Errors produced from listeners are then made into "Global" errors.
 *   A Global error (to the individual DBTracker) is not as gracefully handled:
 *   This ignores any running Promises that the DBTracker was waiting for,
 *   (e.g. EventStateMapping promises) and instead: Every listener for every
 *   parameter has its state set to {err: error caught}.
 *
 *   _all listeners are then removed from the DBTracker after a global error_
 *   The DBTracker becomes in an error'd state, and no proper recovery apart
 *   from setting this.error = null and re-adding the removed listeners.
 *
 *   Errors thrown in the process of the above Global error being passed to
 *   listeners are logged to console and dropped.
 *
 *   The first "Global" error is stored in this.error
 *
 * Implementation:
 *   At construction time is when the PouchDB's change events are hooked into.
 *   This is done using a 'TrackPoint' object: Just an event name, and
 *   converter functions to get the Param(s) & State(s) (key & value) that
 *   were updated in the event.
 *
 *   Each listener is stored in a list. 1 list per Param
 *
 * Example:
 *   Params: When a DBTracker is used (i.e. with useDBTracker), it is tracking
 *   a specific thing, e.g. a project, or an observation in a project, or a
 *   specific revision of an observation in a project. Params is used in said
 *   specification, e.g. [project_id], [project_id, observation_id], etc.
 */
export class DBTracker<P extends unknown[], S> {
  store_all = true;

  eager_load?: EventStateMapping<P, S>;

  _start_eager_load(params: P) {
    if (this.states.get(stable_stringify(params))?.value !== undefined) {
      // Already loaded
      return;
    }

    if (this.eager_load !== undefined) {
      // Call without the 'this' being bound to this DBTracker,
      // Also, typescript needs a bit of help with Type resolution on ...any[]
      const unbound: (...params: [...P]) => S | Promise<S> = this.eager_load;
      this._promisedState(params, Promise.resolve(unbound(...params)));
    }
  }

  error = null as null | {};

  /**
   * For every unique parameters, it has a unique state. This state
   * is generated by EventStateMapping<P, S>, and is generated when
   * an event from the initializeEvents is emitted.
   *
   * Params are JSON stringified before adding to this map so that
   * it is keys that are actually meaningfully comparable, instead of the
   * array of strings that always compare == equal to false.
   *
   * A valid param not being in the map signifies that there's no StateListeners
   * for the given param. e.g. there is no reason to listen for projectA if the
   * only thing visible on the webpage is projectB, so projectB will be the
   * only param of this map.
   *
   * However if store_all is true, then not being in the map only signifies that
   * no events have been received for the param.
   */
  states: Map<string, FullState<S>> = new Map();

  /**
   * Gets the current state corresponding to a Params
   * If the params is unknown, returns {loading:false}
   * (Which is returned even if addListener(params) was called)
   *
   * @param params Parameters to get state for, e.g. {project_id}
   * @returns State of the current param. {loading: boolean} means
   *          that no updates have been received for the given param yet.
   */
  getState(params: P): FullState<S> {
    this._start_eager_load(params);
    return (
      this.states.get(stable_stringify(params)) ||
      new FullState<S>({loading: false})
    );
  }

  /**
   * @note DO NOT use this in REACT or a react hook. You should be keeping
   *       up to date! This doesn't trigger more than once, so keeping up to
   *       date using this is impossible. This is more useful for tests.
   *
   * Gets the current, or if currently loading, the future state for a
   * given Params. This essentially adds a one-time Listener if the Params is
   * unknown, resolving the callback (or erroring). Else, if it's known or
   * errored, the promise resolves immediately.
   *
   * @param params Parameters to get state for, e.g. {project_id}
   * @returns State of the given param, waiting for any loading to happen if
   *          the state isn't yet known.
   */
  promiseState(params: P): Promise<S> {
    return new Promise((resolve, reject) => {
      const listener = (state: FullState<S>) => {
        state.match(
          // Resolve immediately, also removing this listener:
          state => {
            this.removeListener(params, listener);
            resolve(state);
          },
          error => {
            this.removeListener(params, listener);
            reject(error);
          },
          // Loading: Do nothing: Wait for more updates to come through:
          () => {}
        );
      };

      this.addListener(params, listener);
      // If this DBTracker KNOWS Already what the state is for the params,
      // this listener call immediately removes the above added listener,
      // and then resolves/rejects the returned Promise.
      return listener(this.getState(params));
    });
  }

  /**
   * Instantiated at construction time of the DBTracker,
   * and when the initializeEvents calls the _attachTo function,
   *
   * Since for each track_point argument to DBTracker.constructor will run a
   * EventEmitter.on(...), said event has to be removed sometime.
   * To faciliate this removal, the second arg to EventEmitter.on is saved
   * for every TrackPoint<P, S>, in this variable.
   */
  _attachments: Map<TrackPoint<P, S>, AttachedPoint> = new Map();

  /**
   * Between when an event is emitted and the Promise<State> is resolved,
   * a State for the corresponding Parameter is in a loading state.
   *
   * Params are JSON stringified before adding to this map so that
   * it is keys that are actually meaningfully comparable, instead of the
   * array of strings that always compare == equal to false.
   *
   * This state is reflected in this.states. But also, while in this state,
   * another event may be emitted, in which case the first Promise<State>
   * MUST NOT be allowed to resolve. To disallow this, this _load_interrupts
   * increments whenever a Promise is about to be listened for.
   *
   * See _promisedState
   */
  _load_interrupts: Map<string, number> = new Map();

  /**
   * Similarly to _load_interrupts, between when an event is emitted and the
   * Promise<Params> is resolved, this whole DBTracker is in a loading state
   *
   * This state is not reflected anywhere except to the extent that a Promise
   * is running. But while in this state, another event may be emitted, in which
   * case the first Promise<Params> MUST WAIT for the second Promise<Params> to
   * resolve. If they both resolve to the same Params, only one Promise<State>
   * is fetched. (If they're different, they won't interefere, so it's fine)
   *
   * This is to prevent an event occuring, then another event of the same Params
   * as the first to occur and go through all code before the first event has a
   * chance to set _load_interrupts.
   *
   * See _promisedParams
   */
  _params_interrupt = 1;

  /**
   * While a Promise<Params> is resolving, this accumulates the list of all
   * Promise<Params> that resolved but were interrupted by another one resolving
   *
   * Params are JSON stringified before adding to this map so that
   * it is keys that are actually meaningfully comparable, instead of the
   * array of strings that always compare == equal to false.
   */
  _params_resolved = new Map<string, (resolved: P) => void>();

  /*
   * Each of these _X_listeners maps stores a list of callables to be run
   * when the State corresponding to the given Param P changes.
   * This might be the state starting to load another state (unload_listeners)
   * or it might be an error/resolve
   *
   * Params are JSON stringified before adding to this map so that
   * it is keys that are actually meaningfully comparable, instead of the
   * array of strings that always compare == equal to false.
   */

  _local_listeners: Map<string, StateListener<S>[]> = new Map();

  /**
   * Similar to the above list of listeners per-Params, there is this
   * below set of listeners that are triggered regardless of the Params
   * they are triggered for.
   */
  _global_listeners: Set<GlobalListener<P, S>> = new Set();

  /**
   * Main publically used function: To listen for changes to a DB's object
   * The DB object is parameterized by P, so the specific object to listen to
   * is given as params.
   *
   * If this DBTracker is not store_all, then an addListener call is required
   * for each param's state you wish to keep track of
   *
   * @param params Parameter to filter updates by
   * @param listener Listener to execute when the state
   *                 of this.state.get(params) is changed.
   */
  addListener(params: P, listener: StateListener<S>): void {
    const listeners_for_params = this._local_listeners.get(
      stable_stringify(params)
    );
    if (listeners_for_params !== undefined) {
      listeners_for_params.push(listener);
    } else {
      this._local_listeners.set(stable_stringify(params), [listener]);
    }

    if (!this.states.has(stable_stringify(params))) {
      // First encounter with the given params, must updates to be "loading"
      this._setState(params, {loading: false}, true);
      // If eager loading is enabled, this immediately sets loading to true
      this._start_eager_load(params);
    }
  }

  /**
   * Adds the given listener to the list of listeners that will be called when
   * any DB update happens (and after the param and state is known), as well as
   * when a listener or other place throws an error.
   *
   * @param listener Listener to execute after state change is applied or
   *                 when an error in a listener occurs.
   */
  addGlobalListener(listener: GlobalListener<P, S>): void {
    this._global_listeners.add(listener);
  }

  /**
   * Remove listeners that were added by addListener
   * State for a given param will stick around until all its listeners are removed
   * So this serves to allow GC'ing of state if store_all is false
   *
   * @param params Parameter that updates were filtered by
   * @param listener Listener that was added by addListener, now to be removed
   */
  removeListener(params: P, listener: StateListener<S>): void {
    const listeners_for_params = this._local_listeners.get(
      stable_stringify(params)
    );
    if (listeners_for_params !== undefined) {
      if (listeners_for_params === [listener]) {
        // This was the last listener left for said parameter
        this._local_listeners.delete(stable_stringify(params));
        this._try_cleanup_unlistened(params);
      } else {
        const idx = listeners_for_params.indexOf(listener);
        if (idx >= 0) {
          // Listener found, delete 1 element
          listeners_for_params?.splice(idx, 1);
        }
      }
    }
  }

  /**
   * Remove listeners that were added by addGlobalListener
   *
   * @param listener Listener that was added by addGloballistener, to now be
   *                 removed
   */
  removeGlobalListener(listener: GlobalListener<P, S>): void {
    this._global_listeners.delete(listener);
  }

  _try_cleanup_unlistened(params: P): void {
    // When all listeners for a given Params removed,
    // we can remove the state as well
    if (
      !this.store_all &&
      !this._local_listeners.has(stable_stringify(params))
    ) {
      this.states.delete(stable_stringify(params));
    }
  }

  constructor(
    ...track_points:
      | TrackPoint<P, S>[]
      | [EventStateMapping<P, S>, ...TrackPoint<P, S>[]]
  ) {
    const has_eager = (
      x: TrackPoint<P, S>[] | [EventStateMapping<P, S>, ...TrackPoint<P, S>[]]
    ): x is [EventStateMapping<P, S>, ...TrackPoint<P, S>[]] =>
      typeof x[0] === 'function';

    if (has_eager(track_points)) {
      // Overload 2: eager_load is set to the first EventStateMapping
      this.eager_load = track_points[0];
      const track_points_real = (track_points.slice(
        1
      ) as unknown[]) as TrackPoint<P, S>[];

      add_initial_listener(this._attachTo.bind(this, track_points_real));
    } else {
      // Overload 1: eager_load is left undefined
      add_initial_listener(this._attachTo.bind(this, track_points));
    }
  }

  /**
   * Throws an error that was thrown by an EventStateMapping or a listener
   * (listening to non-error states) to the listeners on a param corresponding
   * to where it was thrown from.
   *
   * To prevent a listener throwing an error, then receiving the error it just
   * threw back in as a parameter to itself, and prevent infinite recursion when
   * the user throws a passed-error from more than 1 listener, set
   * notify_listeners only when the errors is NOT from a listener (i.e. only
   * when the error occurred in EventStateMapping function)
   *
   * @param params Parameters for which an error occurred locally in
   * @param error Error thrown by user-code, either EventStateMapper or listener
   */
  _localError(params: P, error: {}, notify_listeners: boolean) {
    // Interrupt specific promises
    const interruptable_promise = this._load_interrupts.get(
      stable_stringify(params)
    );
    if (interruptable_promise !== undefined) {
      this._load_interrupts.set(
        stable_stringify(params),
        interruptable_promise + 1
      );
    }

    if (this.states.get(stable_stringify(params))?.error !== undefined) {
      // This params is already in an error state:
      // Don't change the error, and don't update any listeners
      return;
    }

    const full_state = new FullState<S>({err: error});

    // Error out the state for the Param
    // (This is done manually, not using _setState, as to not
    // accidentally recurse infinitley, as well as to ensure
    // the error is 'atomically' set, not letting listeners
    // run and see non-errored state for other Params)
    this.states.set(stable_stringify(params), full_state);

    // Call listeners (as long as it wasn't a listener that initated this error)
    const listeners = this._local_listeners.get(stable_stringify(params));
    if (notify_listeners) {
      for (const listener of Array.from(this._global_listeners.values())) {
        try {
          listener(params, full_state);
        } catch (err) {
          console.error(
            'DBTracker global listener emitted an error while handling error',
            params,
            err
          );
          // Breaks this loop to emit a global error
          return this._globalError(error, false);
        }
      }
      if (listeners !== undefined) {
        for (const listener of listeners) {
          try {
            listener(full_state);
          } catch (err) {
            console.error(
              'DBTracker listener emitted an error while handling an error',
              params,
              err
            );
            // Breaks this loop to emit a global error
            return this._globalError(error, false);
          }
        }
      }
    }
  }

  /**
   * Called when an error is thrown in general DBTracker operation, but it
   * doesn't make sense being a _localError (i.e. it isn't from
   * EventStateMapping or a listener listening to non-error states)
   *
   * Sets this whole DBTracker into a bad 'error' state, throwing the given
   * error to _all_ listeners and then removing all listeners.
   *
   * To prevent a listener throwing an error, then receiving the error it just
   * threw back in as a parameter to itself, and prevent very big recursion when
   * the user throws a passed-error from more than 1 listener, set
   * notify_listeners only when the errors is NOT from a listener (i.e. only
   * when the error occurred in EventParamMapping function)
   *
   * @param error Error that was thrown
   */
  _globalError(error: {}, notify_listeners: boolean) {
    // Interrupt absolutely every promise:
    this._load_interrupts.forEach((last_int, params) =>
      this._load_interrupts.set(stable_stringify(params), last_int + 1)
    );
    this._params_interrupt += 1;
    this._params_resolved.clear();
    // Error out all known Param's being kept track of
    // (This is done manually, not using _setState, as to not
    // accidentally recurse infinitley, as well as to ensure
    // the error is 'atomically' set, not letting listeners
    // run and see non-errored state for other Params)

    const full_state = new FullState<S>({err: error});

    this.states.forEach((old_state, known_params) =>
      this.states.set(known_params, full_state)
    );
    this.error = error;

    if (notify_listeners) {
      this._global_listeners.forEach(listener => {
        try {
          listener(undefined, full_state);
        } catch (err) {
          console.error(
            'DBTracker global listener emitted an error while handling a DBTracker error',
            err
          );
        }
      });

      this._local_listeners.forEach(listeners =>
        listeners.forEach(listener => {
          try {
            listener(full_state);
          } catch (err) {
            console.error(
              'DBTracker listener emitted an error while handling a DBTracker error',
              err
            );
          }
        })
      );
    }

    this._global_listeners.clear();
    this._local_listeners.clear();
  }

  /**
   * Sets/Updates the state for a given Param that is being listened for
   * (or if store_all is true, sets/updates the state)
   *
   * If this isn't in store_all mode, and the Param is not yet listening,
   * nothing will be done in this function.
   *
   * Errors are propagated to this._localError(params)
   *
   * @param params Param to update the corresponding state for
   * @param state State to set param to, NOT LOADING, either error or valid.
   */
  _setState(
    params: P,
    state: {loading: boolean} | {state: S},
    store_new = false,
    over_error = false
  ) {
    if (
      this.states.has(stable_stringify(params)) ||
      this.store_all ||
      store_new
    ) {
      if (
        !over_error &&
        this.states.get(stable_stringify(params))?.error !== undefined
      ) {
        return; // Don't overwrite errors normally
      }

      const full_state = new FullState<S>(state);

      this.states.set(stable_stringify(params), full_state);

      // Run state listeners
      const listeners = this._local_listeners.get(stable_stringify(params));
      for (const listener of Array.from(this._global_listeners.keys())) {
        try {
          listener(params, full_state);
        } catch (error) {
          this._localError(params, error, false);
        }
      }
      if (listeners !== undefined) {
        for (const listener of listeners) {
          try {
            listener(full_state);
          } catch (error) {
            this._localError(params, error, false);
            break;
          }
        }
      }
    }
  }

  /**
   * When a Params is about to become available (we may be waiting for PouchDB,
   * or waiting for an EventStateMapping to resolve) this is called with the
   * promise to get the Params
   *
   * If the promise resolves, the callback is called
   *
   * If something else calls _promisedParams before unresolved resolves, this will
   * wait both unresolved's to resolve before any callback is run
   *
   * If something else calls _promisedParams before unresolved resolves, AND
   * said something resolves to the same thing that this unresolved resolves to,
   * ONLY the callback for the latest resolution is called.
   *
   * @param unresolved Promise that will resolve to a Param value
   * @param callback When it is know that no other _promisedParams with
   *                 the same Param value is going to be, or has resolved,
   *                 this is called. It is usually _promisedState bound to
   *                 some state resolution from a track point in _attachTo
   *                 This is expected to do its own error handling
   */
  _promisedParams(unresolved: Promise<P[]>, callback: (resolved: P) => void) {
    const my_load = this._params_interrupt + 1;
    this._params_interrupt = my_load;

    unresolved
      .then((params_list: P[]) => {
        // Another _promisedParams may currently still be resolving
        // while this one's .then is running, here.

        // Last callback for this Param is set, to be run when no more
        // _promisedParams are running:
        params_list.forEach(params =>
          this._params_resolved.set(stable_stringify(params), callback)
        );

        if (this._params_interrupt === my_load) {
          // No other Promise<Param>s to wait for, execute all the latest
          // callbacks for each unique Param:
          this._params_resolved.forEach((cb, params) => cb(JSON.parse(params)));
          this._params_resolved.clear();
        }
      })
      .catch(err => this._globalError(err, true));
  }

  /**
   * When a State is about to become available (we may be waiting for PouchDB,
   * or waiting for an EventStateMapping to resolve) this is called with the
   * Promise to get the state.
   *
   * If the Promise resolves, this DBTracker updates the state for the given
   * param, and notifies anything listening for updates on the given param.
   *
   * If something else calles _promisedState before the first Promise resolves,
   * the first Promise's result and ERRORS are completley IGNORED.
   *
   * _resolveState or _errorState will be called after the Promise resolves,
   * which go on to call the state_listeners or error_listeners
   *
   * @param params Param that is about to have its state updated
   * @param state Promise resolving into state, or error
   */
  _promisedState(params: P, state: Promise<S>) {
    const params_str = stable_stringify(params);
    const existing_state = this.states.get(params_str);
    if (!this.store_all && existing_state === undefined) {
      // Not storing any unlistened states:
      return;
    }

    // Like _rejectState, _resolveState, the this.states must be updated
    // as to not expose old state
    if (existing_state?.loading !== 'reload') {
      this._setState(params, {loading: true});
    }

    // INTERRUPTION

    // To be able to interrupt something, the _load_interrupts is incremented
    const my_load = (this._load_interrupts.get(params_str) || 0) + 1;

    // Update to reflect my_load:
    this._load_interrupts.set(params_str, my_load);

    // To detect interruption, my_load is compared with this._load_interrupts.get(params_str)
    // When the state promise resolves/rejects
    const is_uninterrupted = () =>
      my_load === this._load_interrupts.get(params_str);

    // LISTENING

    state.then(
      (state: S) => {
        if (is_uninterrupted()) {
          this._setState(params, {state: state});
        }
      },
      (err: {}) => {
        // Interrupt everything else
        this._load_interrupts.set(
          params_str,
          this._load_interrupts.get(params_str)! + 1
        );
        this._localError(params, err, true);
      }
    );
  }

  _event_router(tpoint: TrackPoint<P, S>, ...args: unknown[]) {
    let wait_params;

    if (tpoint.length === 2) {
      // Given this TrackPoint triggered, it triggers updates for ALL listening
      // (all known) states (but it doesn't add any more params to the state)
      wait_params = Promise.resolve(
        Array.from(this.states.keys()).map(k => JSON.parse(k))
      );
    } else {
      // This TrackPoint derives a specific Params that changed.
      //
      // _promisedParams takes a Promise, but tpoint[1] might be a non-promise
      // so resolve directly:
      wait_params = Promise.resolve(tpoint[2](...args));
    }
    this._promisedParams(wait_params, this_params => {
      // And now we again wait for a Promise to resolve, but this time
      // it's the per-Param state that must resolve
      const wait_state = Promise.resolve(tpoint[1](...this_params, ...args));
      this._promisedState(this_params, wait_state);
    });
  }

  /**
   * Called once the EventEmitter is created, this attaches the events for this
   * DBTracker to the EventEmitter. Events are only attached once, when this is called
   *
   * @param track_points The events and their corresponding conversions to param/state
   *                     that are to be registered on the event emitter to listen on.
   * @param emitter EventEmitter ot listen for updates on.
   */
  _attachTo(track_points: TrackPoint<P, S>[], emitter: EventEmitter): void {
    // For each 'event' to attach to:
    for (const tpoint of track_points) {
      // The listener:
      const attach_point = this._event_router.bind(this, tpoint);

      // Store it for later deletion
      if (this._attachments.has(tpoint)) {
        throw Error('DBTracker _attachTo called twice');
      }
      this._attachments.set(tpoint, attach_point);

      // Listen to event and trigger the listener
      emitter.on(tpoint[0], attach_point);
    }
  }
}

export function useDBTracker<P extends unknown[], S>(
  tracker: DBTracker<P, S>,
  params: P
): FullState<S> {
  const [reactState, setReactState] = useState(tracker.getState(params));
  useEffect(() => {
    tracker.addListener(params, setReactState);
    return tracker.removeListener.bind(tracker, params, setReactState);
  }, [params]);

  return reactState;
}
