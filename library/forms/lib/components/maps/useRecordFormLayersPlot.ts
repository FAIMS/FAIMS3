// SPDX-License-Identifier: Apache-2.0

/**
 * Attach one OpenLayers vector layer per form with spatial records, paint it
 * from `recordLayers`, and keep collected geometry under the user sketch.
 */

import {Extent} from 'ol/extent';
import {FeatureLike} from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import {transformExtent} from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import {useEffect, useRef} from 'react';
import {
  contextualVectorStyle,
  selectedVectorStyle,
} from './contextualVectorStyle';
import {
  applyRecordFormLayerPaint,
  defaultRecordFormLayerPrefs,
  type RecordFormLayer,
} from './recordFormLayers';
import {
  groupRecordFeaturesByForm,
  recordFeatureSyncKey,
  type RecordFeatureCollection,
} from './recordFormMapLayers';

/** Selection used only by the overview map's View-record highlight. */
export type RecordFormLayerPlotSelection = {
  record_id: string;
  revision_id: string;
} | null;

/** True when two form-id → bbox maps have the same keys and extents. */
function formExtentsEqual(
  left: Record<string, [number, number, number, number]>,
  right: Record<string, [number, number, number, number]>
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every(key => {
    const a = left[key];
    const b = right[key];
    return (
      !!b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]
    );
  });
}

/**
 * Plot collected-record GeoJSON onto `map`. Record layers use
 * {@link applyRecordFormLayerPaint} (z-index in the record-form band). Do not
 * attach overview-map pointer hit-testing here.
 */
export function useRecordFormLayersPlot({
  map,
  collection,
  recordLayers,
  overviewMapTypes,
  selectedFeature = null,
  onFormExtents,
  onOverallExtent,
}: {
  map: Map | undefined;
  collection: RecordFeatureCollection | undefined;
  recordLayers: RecordFormLayer[];
  overviewMapTypes: string[];
  selectedFeature?: RecordFormLayerPlotSelection;
  onFormExtents?: (
    extents: Record<string, [number, number, number, number]>
  ) => void;
  /** First overall extent of plotted features (overview map fit). Omit on the popup. */
  onOverallExtent?: (extent: Extent) => void;
}): void {
  const layersByFormRef = useRef(
    new globalThis.Map<string, VectorLayer<VectorSource>>()
  );
  const recordLayersRef = useRef(recordLayers);
  recordLayersRef.current = recordLayers;
  const selectedFeatureRef = useRef(selectedFeature);
  const collectionRef = useRef(collection);
  collectionRef.current = collection;
  const plottedSyncKey = recordFeatureSyncKey(collection);
  const formExtentsRef = useRef<
    Record<string, [number, number, number, number]>
  >({});
  const onFormExtentsRef = useRef(onFormExtents);
  onFormExtentsRef.current = onFormExtents;
  const onOverallExtentRef = useRef(onOverallExtent);
  onOverallExtentRef.current = onOverallExtent;

  useEffect(() => {
    selectedFeatureRef.current = selectedFeature;
    for (const layer of layersByFormRef.current.values()) {
      layer.changed();
    }
  }, [selectedFeature]);

  useEffect(() => {
    const current = collectionRef.current;
    if (!map || !current || current.features.length === 0) {
      return;
    }

    const grouped = groupRecordFeaturesByForm(current);
    const formIds = new Set(grouped.keys());
    const geoJson = new GeoJSON();
    const nextExtents: Record<string, [number, number, number, number]> = {};
    let overallExtent: Extent | undefined;

    for (const [formId, layer] of layersByFormRef.current) {
      if (!formIds.has(formId)) {
        map.removeLayer(layer);
        layersByFormRef.current.delete(formId);
      }
    }

    for (const [formId, formCollection] of grouped) {
      let layer = layersByFormRef.current.get(formId);
      if (!layer) {
        layer = new VectorLayer({
          source: new VectorSource(),
          style: (olFeature: FeatureLike) => {
            const spec =
              recordLayersRef.current.find(item => item.formId === formId) ??
              defaultRecordFormLayerPrefs(formId, overviewMapTypes, 0);
            const recordId = olFeature.get('record_id') as string | undefined;
            const revisionId = olFeature.get('revision_id') as
              | string
              | undefined;
            const selected = selectedFeatureRef.current;
            const isSelected = Boolean(
              selected &&
              recordId === selected.record_id &&
              revisionId === selected.revision_id
            );
            return isSelected
              ? selectedVectorStyle(spec)
              : contextualVectorStyle(spec);
          },
        });
        map.addLayer(layer);
        layersByFormRef.current.set(formId, layer);
      }

      const source = layer.getSource();
      if (!source) {
        continue;
      }
      source.clear();
      try {
        const parsedFeatures = geoJson.readFeatures(formCollection, {
          dataProjection: 'EPSG:4326',
          featureProjection: map.getView().getProjection(),
        });
        source.addFeatures(parsedFeatures);
        const sourceExtent = source.getExtent();
        if (
          sourceExtent &&
          !sourceExtent.some((val: number) => !isFinite(val))
        ) {
          const extent = transformExtent(
            sourceExtent,
            map.getView().getProjection(),
            'EPSG:4326'
          );
          if (!extent.some((val: number) => !isFinite(val))) {
            nextExtents[formId] = extent as [number, number, number, number];
            overallExtent = overallExtent
              ? [
                  Math.min(overallExtent[0], extent[0]),
                  Math.min(overallExtent[1], extent[1]),
                  Math.max(overallExtent[2], extent[2]),
                  Math.max(overallExtent[3], extent[3]),
                ]
              : extent;
          }
        }
      } catch (error) {
        console.error('Failed to parse GeoJSON features:', error);
      }

      const spec = recordLayersRef.current.find(item => item.formId === formId);
      if (spec) {
        applyRecordFormLayerPaint(layer, spec);
      }
    }

    if (!formExtentsEqual(formExtentsRef.current, nextExtents)) {
      formExtentsRef.current = nextExtents;
      onFormExtentsRef.current?.(nextExtents);
    }
    if (overallExtent) {
      onOverallExtentRef.current?.(overallExtent);
    }
  }, [map, overviewMapTypes, plottedSyncKey]);

  useEffect(() => {
    return () => {
      if (!map) {
        return;
      }
      for (const layer of layersByFormRef.current.values()) {
        map.removeLayer(layer);
      }
      layersByFormRef.current.clear();
    };
  }, [map]);

  useEffect(() => {
    for (const spec of recordLayers) {
      const layer = layersByFormRef.current.get(spec.formId);
      if (layer) {
        applyRecordFormLayerPaint(layer, spec);
        layer.changed();
      }
    }
  }, [recordLayers]);
}
