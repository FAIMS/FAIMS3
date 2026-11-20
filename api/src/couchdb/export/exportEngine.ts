// SPDX-License-Identifier: Apache-2.0
import {
  CompiledNotebookUiSpec,
  DatabaseInterface,
  DataDbType,
  DataDocument,
  DataEngine,
} from '@faims3/data-model';

/** Engine the record iterator resolves computed values through. */
export const exportEngine = (
  dataDb: DataDbType,
  uiSpecification: CompiledNotebookUiSpec
): DataEngine =>
  new DataEngine({
    dataDb: dataDb as unknown as DatabaseInterface<DataDocument>,
    uiSpec: uiSpecification,
  });
