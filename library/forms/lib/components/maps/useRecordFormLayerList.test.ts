// SPDX-License-Identifier: Apache-2.0
import {act, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {readRecordFormLayerPrefs} from './recordFormLayers';
import {useRecordFormLayerList} from './useRecordFormLayerList';

afterEach(() => {
  localStorage.clear();
});

describe('useRecordFormLayerList', () => {
  it('shares hide/show through map-record-form-prefs for the same project', () => {
    const descriptors = [{formId: 'Site', name: 'Sites'}];
    const {result, unmount} = renderHook(() =>
      useRecordFormLayerList({
        projectId: 'project-1',
        descriptors,
        colorFormIds: ['Site', 'Observation'],
      })
    );

    expect(result.current.recordLayers[0]).toMatchObject({
      id: 'record-form:Site',
      kind: 'record-form',
      visible: true,
    });

    act(() => {
      result.current.updateRecordLayer('record-form:Site', {visible: false});
    });

    expect(result.current.recordLayers[0].visible).toBe(false);
    expect(
      readRecordFormLayerPrefs('project-1')['record-form:Site'].visible
    ).toBe(false);

    unmount();

    const {result: overview} = renderHook(() =>
      useRecordFormLayerList({
        projectId: 'project-1',
        descriptors,
        colorFormIds: ['Site', 'Observation'],
      })
    );
    expect(overview.current.recordLayers[0].visible).toBe(false);
  });
});
