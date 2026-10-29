// SPDX-License-Identifier: Apache-2.0
import {afterEach, describe, expect, it} from 'vitest';
import {RECORD_FORM_LAYER_Z_INDEX_BASE} from './layerStack';
import {
  applyRecordFormLayerPaint,
  applyRecordFormLayerPatch,
  buildRecordFormLayers,
  defaultRecordFormLayerPrefs,
  formIdFromRecordFormLayerId,
  normalizeRecordFormLayersPrefsState,
  readRecordFormLayerPrefs,
  RECORD_FORM_LAYER_COLORS,
  recordFormLayerId,
  writeRecordFormLayerPrefs,
} from './recordFormLayers';

afterEach(() => {
  localStorage.clear();
});

describe('recordFormLayers', () => {
  it('keys layer ids by form and ignores unknown patches', () => {
    expect(recordFormLayerId('Site')).toBe('record-form:Site');
    expect(formIdFromRecordFormLayerId('record-form:Site')).toBe('Site');
    expect(formIdFromRecordFormLayerId('boundary')).toBeUndefined();

    const fallback = defaultRecordFormLayerPrefs('Site', ['Site'], 0);
    expect(
      applyRecordFormLayerPatch({}, 'boundary', {visible: false}, fallback)
    ).toEqual({});
  });

  it('assigns stable default colors from the notebook form list', () => {
    const site = defaultRecordFormLayerPrefs(
      'Site',
      ['Observation', 'Site'],
      0
    );
    const observation = defaultRecordFormLayerPrefs(
      'Observation',
      ['Observation', 'Site'],
      1
    );
    expect(site.stroke).toBe(RECORD_FORM_LAYER_COLORS[1]);
    expect(observation.stroke).toBe(RECORD_FORM_LAYER_COLORS[0]);
    expect(site.fill).toBe(`${site.stroke}80`);
    expect(site.zIndex).toBe(RECORD_FORM_LAYER_Z_INDEX_BASE);
  });

  it('merges stored paint onto defaults and persists per project', () => {
    const stored = {
      'record-form:Site': {
        visible: false,
        opacity: 0.4,
        zIndex: 12,
        stroke: '#111111',
        fill: '#222222',
        lineWidth: 3,
        pointSize: 9,
      },
    };
    writeRecordFormLayerPrefs('proj-1', stored);
    expect(readRecordFormLayerPrefs('proj-1')).toEqual(stored);
    expect(readRecordFormLayerPrefs('proj-2')).toEqual({});

    const layers = buildRecordFormLayers(
      [{formId: 'Site', name: 'Sites', extent4326: [0, 0, 1, 1]}],
      readRecordFormLayerPrefs('proj-1'),
      ['Site']
    );
    expect(layers).toEqual([
      {
        id: 'record-form:Site',
        formId: 'Site',
        name: 'Sites',
        kind: 'record-form',
        visible: false,
        opacity: 0.4,
        zIndex: 12,
        stroke: '#111111',
        fill: '#222222',
        lineWidth: 3,
        pointSize: 9,
        extent4326: [0, 0, 1, 1],
      },
    ]);
  });

  it('clamps paint values and paints the OpenLayers layer', () => {
    expect(
      normalizeRecordFormLayersPrefsState({
        'record-form:Site': {opacity: 4, lineWidth: 0, pointSize: -2},
        other: {visible: false},
      })['record-form:Site']
    ).toMatchObject({
      opacity: 1,
      lineWidth: 4,
      pointSize: 7,
      visible: true,
    });

    const calls = {visible: false, opacity: 0, zIndex: 0};
    applyRecordFormLayerPaint(
      {
        setVisible: visible => {
          calls.visible = visible;
        },
        setOpacity: opacity => {
          calls.opacity = opacity;
        },
        setZIndex: zIndex => {
          calls.zIndex = zIndex;
        },
      },
      {
        visible: true,
        opacity: 0.25,
        zIndex: 8,
        stroke: '#2171b5',
        fill: '#2171b580',
        lineWidth: 4,
        pointSize: 7,
      }
    );
    expect(calls).toEqual({visible: true, opacity: 0.25, zIndex: 8});
  });
});
