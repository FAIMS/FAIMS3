import {
  type MapCollectionPlan,
  type MinimalRecordMetadata,
} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import {
  createdPlanReferences,
  planRecordFeatures,
} from './planRecordMapFeatures';

const plan: Pick<MapCollectionPlan, 'planId' | 'records'> = {
  planId: 'sites',
  records: {
    'planned-1': {
      fields: {Name: 'A'},
      spatial: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {type: 'Point', coordinates: [1, 1]},
            properties: null,
          },
          {
            type: 'Feature',
            geometry: {type: 'Point', coordinates: [2, 2]},
            properties: null,
          },
        ],
      },
    },
    'planned-2': {
      fields: {},
      spatial: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [0, 0],
                [1, 1],
              ],
            },
            properties: null,
          },
        ],
      },
    },
  },
};

describe('planRecordMapFeatures', () => {
  it('reads the created references off the plan records', () => {
    expect(
      createdPlanReferences([
        {planReference: 'sites/planned-1'},
        {planReference: undefined},
      ] as MinimalRecordMetadata[])
    ).toEqual(new Set(['sites/planned-1']));
  });

  it('plots one feature per planned geometry, tagged with its entry and state', () => {
    const collection = planRecordFeatures({
      plan,
      created: new Set(['sites/planned-1']),
    });
    expect(collection.features.map(f => f.geometry.type)).toEqual([
      'Point',
      'Point',
      'LineString',
    ]);
    expect(collection.features.map(f => f.properties)).toEqual([
      {reference: 'planned-1', planReference: 'sites/planned-1', created: true},
      {reference: 'planned-1', planReference: 'sites/planned-1', created: true},
      {
        reference: 'planned-2',
        planReference: 'sites/planned-2',
        created: false,
      },
    ]);
  });
});
