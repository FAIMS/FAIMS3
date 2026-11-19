// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {
  excludeRecordFormMapFeatures,
  groupRecordFeaturesByForm,
  recordFeatureSyncKey,
  recordFormLayerDescriptors,
  type RecordFeatureCollection,
  type RecordGeoJSONFeature,
} from './recordFormMapLayers';

const feature = (formId: string, recordId: string): RecordGeoJSONFeature => ({
  type: 'Feature',
  geometry: {type: 'Point', coordinates: [151.2, -33.9]},
  properties: {
    name: recordId,
    record_id: recordId,
    revision_id: `${recordId}-rev`,
    form_id: formId,
  },
});

const collection = (
  features: RecordGeoJSONFeature[]
): RecordFeatureCollection => ({
  type: 'FeatureCollection',
  features,
});

describe('recordFormMapLayers helpers', () => {
  it('builds record-form descriptors with form labels and id fallback', () => {
    const descriptors = recordFormLayerDescriptors(
      collection([feature('Site', 'site-1'), feature('Observation', 'obs-1')]),
      formId => (formId === 'Site' ? 'Sites' : ''),
      {Site: [0, 0, 1, 1]}
    );
    expect(descriptors).toEqual([
      {formId: 'Observation', name: 'Observation'},
      {formId: 'Site', name: 'Sites', extent4326: [0, 0, 1, 1]},
    ]);
  });

  it('omits the open record from the plotted collection', () => {
    const source = collection([
      feature('Site', 'site-1'),
      feature('Site', 'open-record'),
    ]);
    expect(excludeRecordFormMapFeatures(source, undefined)).toBe(source);
    expect(
      excludeRecordFormMapFeatures(source, 'open-record')?.features.map(
        item => item.properties.record_id
      )
    ).toEqual(['site-1']);
  });

  it('groups features by form and fingerprints the collection', () => {
    const source = collection([
      feature('Site', 'site-1'),
      feature('Observation', 'obs-1'),
    ]);
    expect([...groupRecordFeaturesByForm(source).keys()]).toEqual([
      'Site',
      'Observation',
    ]);
    expect(recordFeatureSyncKey(undefined)).toBe('');
    expect(recordFeatureSyncKey(collection([]))).toBe('c:');
  });
});
