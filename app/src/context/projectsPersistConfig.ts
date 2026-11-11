// SPDX-License-Identifier: Apache-2.0

/**
 * Project-slice fields excluded from redux-persist.
 * A reload must re-run initialise and must not restore a stuck spinner.
 */
export const PROJECTS_PERSIST_BLACKLIST = [
  'isInitialised',
  'activatingProjects',
] as const;
