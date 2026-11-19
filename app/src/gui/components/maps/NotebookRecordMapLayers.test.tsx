// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom/vitest';
import {
  compileUiSpecConditionals,
  type CompiledNotebookUiSpec,
  type NotebookUiSpec,
} from '@faims3/data-model';
import {
  RecordFormMapLayersContext,
  type RecordFormMapLayersValue,
} from '@faims3/forms';
import {render, screen} from '@testing-library/react';
import {useContext} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {RecordFeatureCollection} from '../notebook/recordFeatures';

const features = vi.hoisted(() => ({
  data: {
    type: 'FeatureCollection',
    features: [],
  } as RecordFeatureCollection | undefined,
}));

const useRecordFeatures = vi.hoisted(() =>
  vi.fn(({recordTypes}: {recordTypes: string[]}) => ({
    data: {
      type: 'FeatureCollection' as const,
      features: (features.data?.features ?? []).filter(feature =>
        recordTypes.includes(feature.properties.form_id)
      ),
    },
    isLoading: false,
    isError: false,
    error: null,
  }))
);

const projectState = vi.hoisted(() => ({
  current: {
    isActivated: true,
    uiSpecificationId: 'spec',
  } as {isActivated: boolean; uiSpecificationId: string} | undefined,
}));

const compiledSpec = vi.hoisted(() => ({
  current: undefined as CompiledNotebookUiSpec | undefined,
}));

vi.mock('../../../context/store', () => ({
  useAppSelector: (selector: (state: object) => unknown) => selector({}),
}));

vi.mock('../../../context/slices/projectSlice', () => ({
  selectProjectById: () => projectState.current,
  isActivatedProject: (project: {isActivated?: boolean} | undefined) =>
    project?.isActivated === true,
}));

vi.mock('../../../context/slices/helpers/compiledSpecService', () => ({
  compiledSpecService: {
    getSpec: () => compiledSpec.current,
  },
}));

vi.mock('../../../utils/customHooks', () => ({
  useRecordList: () => ({
    allRecords: [],
    isLoading: false,
  }),
}));

vi.mock('../notebook/recordFeatures', () => ({
  useRecordFeatures,
}));

import {NotebookRecordMapLayers} from './NotebookRecordMapLayers';

const rawUiSpec: NotebookUiSpec = {
  fields: {
    site_location: {
      'component-namespace': 'mapping-plugin',
      'component-name': 'MapFormField',
      'type-returned': 'faims-core::JSON',
      'component-parameters': {name: 'site_location'},
    },
  },
  views: {
    'site-section': {fields: ['site_location']},
    'obs-section': {fields: ['site_location']},
  },
  viewsets: {
    Site: {views: ['site-section'], label: 'Sites'},
    Observation: {
      views: ['obs-section'],
      label: 'Observations',
      displayInOverviewMap: false,
    },
  },
  visible_types: ['Site', 'Observation'],
  settings: {showQrCodeButton: false},
  schemaVersion: '1',
};
compileUiSpecConditionals(rawUiSpec);
const uiSpec = rawUiSpec as CompiledNotebookUiSpec;

const shownRaw: NotebookUiSpec = {
  ...rawUiSpec,
  viewsets: {
    Site: {views: ['site-section'], label: 'Sites'},
    Observation: {views: ['obs-section'], label: 'Observations'},
  },
};
compileUiSpecConditionals(shownRaw);
const shownCompiled = shownRaw as CompiledNotebookUiSpec;

const feature = (
  formId: string,
  recordId: string
): RecordFeatureCollection['features'][number] => ({
  type: 'Feature',
  geometry: {type: 'Point', coordinates: [151.2, -33.9]},
  properties: {
    name: recordId,
    record_id: recordId,
    revision_id: `${recordId}-rev`,
    form_id: formId,
  },
});

function Consumer() {
  const value = useContext(RecordFormMapLayersContext);
  return (
    <span data-testid="layers">
      {JSON.stringify(
        value.recordLayers.map(layer => ({
          id: layer.id,
          formId: layer.formId,
          name: layer.name,
          kind: layer.kind,
          visible: layer.visible,
        }))
      )}
    </span>
  );
}

function readLayers(): RecordFormMapLayersValue['recordLayers'] {
  return JSON.parse(screen.getByTestId('layers').textContent ?? '[]');
}

describe('NotebookRecordMapLayers', () => {
  beforeEach(() => {
    localStorage.clear();
    useRecordFeatures.mockClear();
    projectState.current = {
      isActivated: true,
      uiSpecificationId: 'spec',
    };
    compiledSpec.current = uiSpec;
    features.data = {
      type: 'FeatureCollection',
      features: [feature('Site', 'site-1'), feature('Observation', 'obs-1')],
    };
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('publishes record-form layers for collected GIS features', () => {
    compiledSpec.current = shownCompiled;
    render(
      <NotebookRecordMapLayers projectId="project-1">
        <Consumer />
      </NotebookRecordMapLayers>
    );

    const layers = readLayers();
    expect(layers.map(layer => layer.name)).toEqual(['Observations', 'Sites']);
    expect(layers.every(layer => layer.kind === 'record-form')).toBe(true);
    expect(layers.map(layer => layer.id)).toEqual([
      'record-form:Observation',
      'record-form:Site',
    ]);
    expect(useRecordFeatures).toHaveBeenCalled();
  });

  it('omits forms with displayInOverviewMap false even when they have geometry', () => {
    render(
      <NotebookRecordMapLayers projectId="project-1">
        <Consumer />
      </NotebookRecordMapLayers>
    );

    const layers = readLayers();
    expect(layers.map(layer => layer.formId)).toEqual(['Site']);
    expect(layers[0]).toMatchObject({
      id: 'record-form:Site',
      name: 'Sites',
      kind: 'record-form',
    });
    expect(useRecordFeatures.mock.calls[0][0].recordTypes).toEqual(['Site']);
  });

  it('publishes an empty list when no collected records have geometry', () => {
    features.data = {type: 'FeatureCollection', features: []};

    render(
      <NotebookRecordMapLayers projectId="project-1">
        <Consumer />
      </NotebookRecordMapLayers>
    );

    expect(readLayers()).toEqual([]);
  });

  it('does not hydrate records when there is no notebook spec', () => {
    compiledSpec.current = undefined;
    projectState.current = undefined;

    render(
      <NotebookRecordMapLayers projectId="project-1">
        <Consumer />
      </NotebookRecordMapLayers>
    );

    expect(readLayers()).toEqual([]);
    expect(useRecordFeatures).not.toHaveBeenCalled();
  });
});
