import EventEmitter from 'events';
import {KeyExportOptions} from 'node:crypto';
import {add_initial_listener} from '.';
import {ProjectObject, ProjectMetaObject} from '../datamodel';

// Anything except a function
type StateTypes = object | number | boolean | string | Array<unknown>;
export interface EventConverter<Key, StateKeptPerKey extends StateTypes> {
  emit_name?: string;
  event_name: string;
  type?: 'add' | 'add_update' | 'update' | 'delete';
  key_getter:
    | (number | string)[] //'Path' on a javascript object
    | ((...event_args: unknown[]) => Key);
  state_getter:
    | StateKeptPerKey
    | ((...event_args: unknown[]) => StateKeptPerKey);
  emit_args?: (...event_args: unknown[]) => unknown[];
}

export class EventStateTracker<
  Key extends object | string,
  StateKeptPerKey extends StateTypes
> extends EventEmitter {
  state = new Map<Key, StateKeptPerKey>();
  _delete_listeners: [Key | null, (updated: Key) => void][] = [];
  _update_listeners: [
    Key | null,
    (updated: Key, newState: StateKeptPerKey) => void
  ][] = [];
  constructor(
    events: EventConverter<Key, StateKeptPerKey>[],
    options?: {captureRejections?: boolean}
  ) {
    super(options);
    add_initial_listener(initializeEvents => {
      // Attach each event listener
      for (const converter of events) {
        (initializeEvents.on as typeof EventEmitter.prototype.on)(
          converter.event_name,
          (...event_args) => setTimeout(() => {
            // Event triggered:
            // Determine key to use then update state.
            const key = key_getter_number_sub(converter, ...event_args);
            if (converter.type === 'delete') {
              this.state.delete(key);

              for (const [key_check, listener] of this._delete_listeners) {
                if (key_check === key) {
                  listener(key);
                }
              }
            } else {
              const perKeyState = state_getter_const_sub(
                converter,
                ...event_args
              );
              this.state.set(key, perKeyState);

              for (const [key_check, listener] of this._update_listeners) {
                if (key_check === key) {
                  listener(key, perKeyState);
                }
              }
            }
            const args_converted = emit_args_or_unaltered(
              converter,
              ...event_args
            );
            const emit_name = converter.emit_name || converter.event_name;
            // Emit manually for individual listeners
            this.emit(emit_name, ...args_converted);
          }, 1000)
        );
      }
    });
  }

  on_delete(key: Key | null, listener: (deleted: Key) => void): this {
    this._delete_listeners.push([key, listener]);
    return this;
  }

  on_update(
    key: Key | null,
    listener: (updated: Key, newState: StateKeptPerKey) => void
  ): this {
    this._update_listeners.push([key, listener]);
    return this;
  }
}

interface multi_indexable {
  [index: number]: multi_indexable;
  [key: string]: multi_indexable;
}

function key_getter_number_sub<K, S extends StateTypes>(
  converter: EventConverter<K, S>,
  ...event_args: unknown[]
): K {
  // If key_getter is a number, return that number indexing into event_args
  // Else run the key_getter with all args
  if (typeof converter.key_getter === 'function') {
    return converter.key_getter(...event_args);
  } else {
    let object: unknown = event_args;
    for (const key of converter.key_getter) {
      object = (object as multi_indexable)[key];
    }
    return object as K;
  }
}

function state_getter_const_sub<K, S extends StateTypes>(
  converter: EventConverter<K, S>,
  ...event_args: unknown[]
): S {
  // If state_getter is a non-function, return state_getter
  // Else run the state_getter with all args
  return typeof converter.state_getter !== 'function'
    ? converter.state_getter
    : (converter.state_getter as (...event_args: unknown[]) => S)(
        ...event_args
      );
}

function emit_args_or_unaltered<K, S extends StateTypes>(
  converter: EventConverter<K, S>,
  ...event_args: unknown[]
): unknown[] {
  return converter.emit_args ? converter.emit_args(...event_args) : event_args;
}
