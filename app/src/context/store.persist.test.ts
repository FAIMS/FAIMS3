// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {PROJECTS_PERSIST_BLACKLIST} from './projectsPersistConfig';

describe('projects persist blacklist', () => {
  it('excludes initialise and in-flight activation so a reload cannot stick a spinner', () => {
    expect(PROJECTS_PERSIST_BLACKLIST).toEqual([
      'isInitialised',
      'activatingProjects',
    ]);
  });
});
