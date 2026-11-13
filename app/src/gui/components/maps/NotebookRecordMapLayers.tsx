// SPDX-License-Identifier: Apache-2.0

/**
 * Hydrates collected-record geometry for every map under the notebook route,
 * including the Map field dialog while the MAP tab is unmounted.
 */

import {
  getOverviewMapTypes,
  type CompiledNotebookUiSpec,
} from '@faims3/data-model';
import {
  emptyRecordFormMapLayers,
  recordFormLayerDescriptors,
  RecordFormMapLayersContext,
  useRecordFormLayerList,
  type RecordFormMapLayersValue,
} from '@faims3/forms';
import {ReactNode, useMemo} from 'react';
import {
  isActivatedProject,
  selectProjectById,
} from '../../../context/slices/projectSlice';
import {compiledSpecService} from '../../../context/slices/helpers/compiledSpecService';
import {useAppSelector} from '../../../context/store';
import {useRecordList} from '../../../utils/customHooks';
import {useRecordFeatures} from '../notebook/recordFeatures';

/** Empty context when the compiled spec is not ready; skips record queries. */
function NotebookRecordMapLayersEmpty({children}: {children: ReactNode}) {
  return (
    <RecordFormMapLayersContext.Provider value={emptyRecordFormMapLayers}>
      {children}
    </RecordFormMapLayersContext.Provider>
  );
}

/**
 * Run GIS hydration for forms allowed on the overview map
 * (`displayInOverviewMap !== false`) and publish `record-form:<formId>` layers.
 */
function NotebookRecordMapLayersHydrated({
  projectId,
  uiSpec,
  children,
}: {
  projectId: string;
  uiSpec: CompiledNotebookUiSpec;
  children: ReactNode;
}) {
  const overviewMapTypes = useMemo(() => getOverviewMapTypes(uiSpec), [uiSpec]);
  const records = useRecordList({
    projectId,
    filterDeleted: true,
    uiSpecification: uiSpec,
    metadataRefreshIntervalMs: 10000,
  });
  const {data: featureCollection} = useRecordFeatures({
    projectId,
    uiSpec,
    records: records.allRecords,
    recordTypes: overviewMapTypes,
  });

  const descriptors = useMemo(
    () =>
      recordFormLayerDescriptors(
        featureCollection,
        formId => uiSpec.viewsets[formId]?.label ?? formId
      ),
    [featureCollection, uiSpec]
  );

  const {recordLayers, updateRecordLayer, resetRecordLayers} =
    useRecordFormLayerList({
      projectId,
      descriptors,
      colorFormIds: overviewMapTypes,
    });

  const value = useMemo<RecordFormMapLayersValue>(
    () => ({
      collection: featureCollection,
      recordLayers,
      overviewMapTypes,
      updateRecordLayer,
      resetRecordLayers,
    }),
    [
      featureCollection,
      overviewMapTypes,
      recordLayers,
      resetRecordLayers,
      updateRecordLayer,
    ]
  );

  return (
    <RecordFormMapLayersContext.Provider value={value}>
      {children}
    </RecordFormMapLayersContext.Provider>
  );
}

/** Shares one notebook's collected-record layers with every map on that screen. */
export function NotebookRecordMapLayers({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const project = useAppSelector(state => selectProjectById(state, projectId));
  const uiSpec =
    project && isActivatedProject(project)
      ? compiledSpecService.getSpec(project.uiSpecificationId)
      : undefined;

  if (!uiSpec) {
    return (
      <NotebookRecordMapLayersEmpty>{children}</NotebookRecordMapLayersEmpty>
    );
  }

  return (
    <NotebookRecordMapLayersHydrated projectId={projectId} uiSpec={uiSpec}>
      {children}
    </NotebookRecordMapLayersHydrated>
  );
}
