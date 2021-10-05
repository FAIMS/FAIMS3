import React, {useEffect, useRef, useState} from 'react';

export class PromiseState<S, L extends null | {}> {
  // Only one of these 3 is defined at a time
  // If all 3 are undefined, then it's loading (but with no initial load params)
  error?: {};
  value?: S;
  loading?: L | undefined;
  constructor(
    full_state:
      | {error: {}; value?: undefined; loading?: undefined}
      | {error?: undefined; value: S; loading?: undefined}
      | {error?: undefined; value?: undefined; loading: L | undefined}
  ) {
    this.error = full_state.error;
    this.value = full_state.value;
    this.loading = full_state.loading;
  }

  /**
   * fmap function for the PromiseState functor: If this PromiseState isn't in a
   * loading/error state, this returns a new PromiseState with the value mapped
   * by the given f function
   * @param f Maps the interior state value. Called 0 or 1 time.
   * @returns A new PromiseState, possibly with same err/loading state, or T from f
   */
  map<T>(f: (state: S) => T): PromiseState<T, L> {
    if (this.value !== undefined) {
      return new PromiseState<T, L>({value: f(this.value)});
    } else {
      // Create a COPY of this, so that we don't have a PromiseState<T> and PromiseState<S>
      // referring to the same object.
      if (this.error !== undefined) {
        return new PromiseState<T, L>({error: this.error});
      } else {
        return new PromiseState<T, L>({loading: this.loading});
      }
    }
  }

  expect(): S | null {
    if (this.value !== undefined) {
      return this.value;
    } else if (this.error !== undefined) {
      throw this.error;
    } else {
      return null;
    }
  }

  map_err(...fs: ((error: {}) => {} | void)[]): PromiseState<S, L> {
    if (this.error !== undefined) {
      // Convert all errors in the fs conversion funcs list, recursively
      if (fs === []) {
        // Base case: No conversion whatsoever, just a copy
        return new PromiseState<S, L>({error: this.error});
      } else {
        // Recursive case: Convert using the first function given.
        return new PromiseState<S, L>({error: fs[0](this.error) || {}}).map_err(
          ...fs.slice(1)
        );
      }
    } else if (this.value !== undefined) {
      return new PromiseState({value: this.value});
    } else {
      return new PromiseState({loading: this.loading});
    }
  }

  /**
   * Calls only 1 of the 3 given functions, depending on what state this
   * PromiseState is in.
   * useful for producing 3 different React Components based on the state
   * @param map_state Branch executed when this PromiseState is NOT errored/loading
   * @param map_error Branch executed when this PromiseState is in an error state
   * @param map_loading Branch executed when this PromiseState is still loading
   */
  match<T, U, V>(
    map_state: (state: S) => T,
    map_error: (error: {}) => U,
    map_loading: (loading: L | undefined) => V
  ): T | U | V {
    if (this.value !== undefined) {
      return map_state(this.value);
    } else if (this.error !== undefined) {
      return map_error(this.error);
    } else {
      return map_loading(this.loading);
    }
  }
}

/**
 *
 * @param attacher prototype of a common listen function that takes a set of A
 *     arguments, then the OK & error callbacks. See databaseAccess.tsx for e.g.
 * @param args Arguments to pass to the trigger_callback
 * @returns
 */
export function constantArgs<FirstArgs extends unknown[]>(
  attacher: (
    listener: () => void | (() => void),
    error_cb: (err: {}) => void
  ) => () => void,
  ...first_args: FirstArgs
): (
  trigger_callback: (...args: FirstArgs) => void,
  error_callback: (error: {}) => void
) => void | (() => void) {
  return (trig, err) => attacher(() => trig(...first_args), err);
}

/**
 *
 * @param attacher prototype of a common listen function that takes a set of A
 *     arguments, then the OK & error callbacks. See databaseAccess.tsx for e.g.
 * @param args Arguments to pass as the first arguments to attacher &
 *     (More importantly) to the trigger_callback
 * @returns
 */
export function constantArgsShared<FirstArgs extends unknown[]>(
  attacher: (
    ...args: [...FirstArgs, () => void | (() => void), (err: {}) => void]
  ) => () => void,
  ...first_args: FirstArgs
): (
  trigger_callback: (...args: FirstArgs) => void,
  error_callback: (error: {}) => void
) => void | (() => void) {
  return (trig, err) => attacher(...first_args, () => trig(...first_args), err);
}

/**
 * React hook abtracting the use of an EventEmitter combined with a Promise
 *
 * Allows you to wait for events to occur, then when they do occur, further
 * wait for a Promise to resolve before give you a final value.
 * In the intermediate state, you can render something different.
 *
 * If you need to start the promise immediately, use useEffect to run the
 * second return value, the manual_trigger
 *
 * This can also (because of PouchDB Change events) cause the promise to re-run
 * whenever an EventEmitter emits an event. (Attaching to this event emitter
 * is left to the user. The user gets a callback to attach)
 *
 * @param startGetting Main promise that gets the value you want
 * @param startListening Gives you a callback that you attach to an EventEmitter
 *                       Also, if the user needs to detach this, this should return
 *                       A 'destructor' to detach it
 * @param listener_dependencies When values in this list change, startListening and stopListening will re-trigger.
 *                              You'd usually use this if startListening listens on different things
 *                              depending on some values, in which case, put said values in this array.
 * @param stopAtError Determines behaviour of error handling:
 *                    true: Whenever an error is thrown from the main promise OR
 *                          from the startListening's error_callback, everything
 *                          part of this hook stops, only returning the last error
 *                    false: An error is treated like a regular value: If new events
 *                           from the listener are triggered, or dependencies change,
 *                           the error is discarded and the promise is re-run.
 * @returns Current state of the promise: Loading, Error, or Resolved, and
 *          Function to manually trigger the Promise to re-run as if an event or
 *          error occurred
 */
export function useEventedPromise<A extends Array<unknown>, V>(
  startGetting: (...args: A) => Promise<V>,
  startListening: (
    trigger_callback: (...args: A) => void,
    error_callback: (error: {}) => void
  ) => void | (() => void), //<- Destructor to detach
  stopAtError: boolean,
  listener_dependencies: React.DependencyList
): [PromiseState<V, A>, (...args: A) => void, (err: {}) => void] {
  const [state, setState] = useState(
    new PromiseState<V, A>({loading: undefined})
  );

  /**
   * To ensure that Promises triggered earlier don't overwrite values returned
   * from promises triggered later, (if the earlier trigger promise takes a lot
   * longer than the later triggered one to execute) This trigger count
   * increments every time a Promise is started, and when said Promise
   * gets its value back, if the trigger count is higher than what it started
   * with (i.e. Another promise was started while this one was running) the
   * result is discarded.
   */
  const triggerCount = useRef(0);

  const promise_value_callback = (thisValuesTriggerCount: number) => (
    new_value: V
  ) => {
    // Don't do anything if we stopped for an error
    if (state.error !== undefined && stopAtError) {
      return;
    }
    // Discard the result if another promise has started later
    // than the current receiving one did start
    if (triggerCount.current === thisValuesTriggerCount) {
      setState(new PromiseState({value: new_value}));
    }
  };

  const promise_error_callback = (
    thisValuesTriggerCount: number
  ) => (new_error: {}) => {
    // Don't do anything if we stopped for an error
    if (state.error !== undefined && stopAtError) {
      return;
    }
    // Discard the result if another promise has started later
    // than the current receiving one did start
    if (triggerCount.current === thisValuesTriggerCount) {
      setState(new PromiseState({error: new_error}));
    }
  };

  const start_waiting_safe = (...args: A) => {
    setState(
      new PromiseState<V, A>({loading: args})
    );
    triggerCount.current += 1;
    startGetting(...args).then(
      promise_value_callback(triggerCount.current),
      promise_error_callback(triggerCount.current)
    );
  };

  const trigger_listener = (...args: A) => {
    // Don't do anything if we stopped for an error
    if (state.error !== undefined && stopAtError) {
      return;
    }
    // Start loading a new value for the promise when an event occurs
    start_waiting_safe(...args);
  };

  const error_listener = (new_error: {}) => {
    // Don't change an error that's already set
    if (state.error !== undefined && stopAtError) {
      return;
    }
    setState(
      new PromiseState<V, A>({error: new_error})
    );
  };

  // Listener-triggered loads
  useEffect(() => {
    try {
      startListening(trigger_listener, error_listener);
    } catch (err: any) {
      error_listener(err);
    }
  }, listener_dependencies);

  return [state, trigger_listener, error_listener];
}

/**
 * More ergonomic, but restrictive, version of useEventedPromise that *always*
 * starts the startGetter immediately (using useEffect) and *always* throws
 * errors using a throw in the hook here. (Returns null when [re]loading)
 * React hook abtracting the use of an EventEmitter combined with a Promise
 *
 * Allows you to wait for events to occur, then when they do occur, further
 * wait for a Promise to resolve before give you a final value.
 * In the intermediate state, you can render something different.
 *
 * This can also (because of PouchDB Change events) cause the promise to re-run
 * whenever an EventEmitter emits an event. (Attaching to this event emitter
 * is left to the user. The user gets a callback to attach)
 *
 * @param startGetting Main promise that gets the value you want
 * @param startListening Gives you a callback that you attach to an EventEmitter
 *                       Also, if the user needs to detach this, this should return
 *                       A 'destructor' to detach it
 * @param listener_dependencies When values in this list change, startListening and stopListening will re-trigger.
 *                              You'd usually use this if startListening listens on different things
 *                              depending on some values, in which case, put said values in this array.
 * @param stopAtError Determines behaviour of error handling:
 *                    true: Whenever an error is thrown from the main promise OR
 *                          from the startListening's error_callback, everything
 *                          part of this hook stops, only returning the last error
 *                    false: An error is treated like a regular value: If new events
 *                           from the listener are triggered, or dependencies change,
 *                           the error is discarded and the promise is re-run.
 * @param start_args Arguments used to call startGetting for the first time, and
 *                   for any subsequent times where a dependency array changes
 * @param start_dependencies Dependency array to cause the startGetting function
 *                           to start running again
 * @returns Current state of the promise: Loading, or Resolved.
 */
export function useEventedPromiseCatchNow<A extends Array<unknown>, V>(
  startGetting: (...args: A) => Promise<V>,
  startListening: (
    trigger_callback: (...args: A) => void,
    error_callback: (error: {}) => void
  ) => void | (() => void), //<- Destructor to detach
  stopAtError: boolean,
  listener_dependencies: React.DependencyList,
  start_args: A,
  start_dependencies: React.DependencyList
): null | V {
  const [result, fetch] = useEventedPromise(
    startGetting,
    startListening,
    stopAtError,
    listener_dependencies
  );
  useEffect(() => fetch(...start_args), start_dependencies);
  return result.expect();
}
