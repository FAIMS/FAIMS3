/*
 * Config helper namespace: Zod schema factories for env / runtime parsing.
 * Helpers return schemas (e.g. `intDefault(10)`); they do not read env vars.
 *
 * Usage:
 *   import {configHelpers} from '@faims3/data-model';
 *   configHelpers.isBlank(value);
 *   configHelpers.optionalEnum(['a', 'b']);
 *   VITE_FOO: configHelpers.boolWithDefault(false),
 */

export * as configHelpers from './helpers';
export type {ConfigHelpers} from './types';
