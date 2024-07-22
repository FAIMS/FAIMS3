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
 * Filename: pouchHook.ts
 * Description:
 *   TODO
 */

import React, {useEffect, useRef, useState} from 'react';
import {DEBUG_APP} from '../buildconfig';

// This specifies how long to hold the refresh locks to prevent a stream of
// events from continuously causing refreshes.
const LOCK_HOLD_TIMEOUT = 5000;
// This specifies at least how long before a new refresh caught by the refresh
// lock should happen after it triggered.
const LOCK_WAIT_TIMEOUT = 1000 * 60 * 2;

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
      if (fs && fs.length === 0) {
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
 * @returns trigger function
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
 * @returns trigger function
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
 *
 * @param attacher prototype of a common listen function that takes a set of A
 *     arguments, then the OK & error callbacks. See databaseAccess.tsx for
 *     examples.
 * @param attach_args Arguments to pass as the first arguments to attacher but
 *     NOT the callback.
 * @param trigger_args Arguments to pass as the first arguments to the
 *     trigger_callback, but NOT the attacher.
 * @returns the trigger function
 */
export function constantArgsSplit<
  AttachArgs extends unknown[],
  TrigArgs extends unknown[]
>(
  attacher: (
    ...args: [...AttachArgs, () => void | (() => void), (err: {}) => void]
  ) => () => void,
  attach_args: AttachArgs,
  trigger_args: TrigArgs
): (
  trigger_callback: (...args: TrigArgs) => void,
  error_callback: (error: {}) => void
) => void | (() => void) {
  return (trig, err) =>
    attacher(...attach_args, () => trig(...trigger_args), err);
}

/**
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
 *                       A 'destructor' to detach it (or if listener_dependencies changes)
 * @param dependencies When values in this list change, the promise re-runs,
 *                     and startListening re-runs, (The stored output of previous call
 *                     to startListening, i.e. last destructor, is run as well)
 *                     You'd usually use this if startListening listens on different things
 *                     depending on some values, in which case, put said values in this array.
 *                     Developer note: I had separate promise and startListening dependencies,
 *                     But in practice they ended up being the same in most use cases,
 *                     and if you've setup destructors properly, it doesn't hurt.
 * @param stopAtError Determines behaviour of error handling:
 *                    true: Whenever an error is thrown from the main promise OR
 *                          from the startListening's error_callback, everything
 *                          part of this hook stops, only returning the last error
 *                    false: An error is treated like a regular value: If new events
 *                           from the listener are triggered, or dependencies change,
 *                           the error is discarded and the promise is re-run.
 * @param args Arguments used to call startGetting for the first time, and
 *             for any subsequent times where a dependency array changes
 * @returns Current state of the promise: Loading, Error, or Resolved, and
 *          Function to manually trigger the Promise to re-run as if an event or
 *          error occurred
 */
export function useEventedPromise<A extends Array<unknown>, V>(
  label: string,
  startGetting: (...args: A) => Promise<V>,
  startListening: (
    trigger_callback: (...args: any) => void,
    error_callback: (error: {}) => void
  ) => void | (() => void), //<- Destructor to detach
  stopAtError: boolean,
  dependencies: React.DependencyList,
  ...args: A
): PromiseState<V, A> {
  //console.log('useEventedPromise', label, dependencies);
  const [state, setState] = useState(
    new PromiseState<V, A>({loading: undefined})
  );
  const refreshLock = useRef(false);
  const refreshLockHit = useRef(false);

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

  const promise_value_callback =
    (thisValuesTriggerCount: number) => (new_value: V) => {
      if (DEBUG_APP) {
        console.debug('current triggerCount', label, triggerCount.current);
        console.debug('thisValuesTriggerCount', label, thisValuesTriggerCount);
      }

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

  const set_error = (new_error: {}) => {
    // Don't do anything if we stopped for an error
    if (state.error !== undefined && stopAtError) {
      return;
    }
    setState(new PromiseState({error: new_error}));
  };

  const promise_error_callback =
    (thisValuesTriggerCount: number) => (new_error: {}) => {
      if (DEBUG_APP) {
        console.debug('current triggerCount', label, triggerCount.current);
        console.debug('thisValuesTriggerCount', label, thisValuesTriggerCount);
      }

      // Discard the result if another promise has started later
      // than the current receiving one did start
      // UNLESS we stopAtError, which is the first error only.
      if (
        triggerCount.current === thisValuesTriggerCount ||
        (state.error === undefined && stopAtError)
      ) {
        set_error(new_error);
      }
    };

  const start_waiting_safe = (...waiter_args: any[]) => {
    if (DEBUG_APP) {
      console.debug('start_waiting_safe args', label, waiter_args);
    }
    // Don't do anything if we stopped for an error
    if (state.error !== undefined && stopAtError) {
      return;
    }
    setState(new PromiseState<V, A>({loading: args}));
    if (DEBUG_APP) {
      console.debug('current triggerCount', label, triggerCount.current);
    }
    triggerCount.current += 1;
    try {
      startGetting(...args).then(
        promise_value_callback(triggerCount.current),
        promise_error_callback(triggerCount.current)
      );
    } catch (err: any) {
      //console.debug('useEventedPromise start_waiting_safe error', label, err);
      promise_value_callback(triggerCount.current)(err);
    }
  };

  const start_waiting_locked = (...waiter_args: any[]) => {
    // Don't try to do anything if we're locked
    if (refreshLock.current) {
      if (DEBUG_APP) {
        console.debug('Still locked!', label);
      }
      if (!refreshLockHit.current) {
        refreshLockHit.current = true;
        if (DEBUG_APP) {
          console.debug('Starting lock wait!', label);
        }
        setTimeout(() => {
          if (DEBUG_APP) {
            console.debug('Running lock wait!', label);
          }
          start_waiting_safe(...waiter_args);
        }, LOCK_WAIT_TIMEOUT + Math.random() * LOCK_WAIT_TIMEOUT);
      } else {
        if (DEBUG_APP) {
          console.debug('Refresh lock still locked!', label);
        }
      }
      return;
    }
    // Activate lock and set timeout to release
    refreshLock.current = true;
    if (DEBUG_APP) {
      console.debug('Locked now!', label);
    }
    setTimeout(() => {
      refreshLock.current = false;
      refreshLockHit.current = false;
      if (DEBUG_APP) {
        console.debug('Unlocked now!', label);
      }
    }, LOCK_HOLD_TIMEOUT);
    start_waiting_safe(...waiter_args);
  };

  // Starting loading as well as start listening for further events.
  useEffect(() => {
    start_waiting_locked();
    let destruct: (() => void) | undefined = undefined;
    try {
      const val = startListening(start_waiting_locked, set_error);
      if (typeof val === 'function') {
        // It's either val or void,
        destruct = val;
      }
    } catch (err: any) {
      set_error(err);
    }
    return destruct;
  }, dependencies);

  return state;
}
