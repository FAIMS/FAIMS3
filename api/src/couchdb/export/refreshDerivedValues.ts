/*
 * Copyright 2026 Macquarie University
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
 * Filename: refreshDerivedValues.ts
 * Description:
 *   Runs the parent-derived value refresh pass (#2245) against a project:
 *   builds the engine and delegates to @faims3/data-model. Called before
 *   export and by the manual refresh endpoint.
 */

import {
  compileUiSpecConditionals,
  DataDocument,
  DatabaseInterface,
  DataEngine,
  refreshDerivedValues,
  RefreshDerivedValuesSummary,
} from '@faims3/data-model';
import {getDataDb} from '..';
import {getCompiledUiSpecModel} from '../notebooks';

/**
 * Re-derives parent-dependent values for all records of the project, writing
 * revisions credited to the given user where values changed. See the pass in
 * @faims3/data-model for semantics; no-ops when the notebook has no
 * parent-dependent fields.
 */
export const refreshProjectDerivedValues = async ({
  projectId,
  updatedBy,
}: {
  projectId: string;
  updatedBy: string;
}): Promise<RefreshDerivedValuesSummary> => {
  const uiSpec = await getCompiledUiSpecModel(projectId);
  // Attach compiled expression functions; computed-field refresh needs them.
  compileUiSpecConditionals(uiSpec);
  const dataDb = await getDataDb(projectId);
  const engine = new DataEngine({
    dataDb: dataDb as unknown as DatabaseInterface<DataDocument>,
    uiSpec,
  });
  return await refreshDerivedValues({engine, updatedBy});
};

/**
 * Best-effort variant for the automatic pre-export hook: a refresh failure
 * is logged but never blocks the export, which then proceeds with
 * last-saved values (the status quo before #2245).
 */
export const tryRefreshProjectDerivedValues = async ({
  projectId,
  updatedBy,
}: {
  projectId: string;
  updatedBy: string;
}): Promise<void> => {
  try {
    await refreshProjectDerivedValues({projectId, updatedBy});
  } catch (e) {
    console.error(
      `Pre-export derived-value refresh failed for project ${projectId}; exporting last-saved values.`,
      e
    );
  }
};
