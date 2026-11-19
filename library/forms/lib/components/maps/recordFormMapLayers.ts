// SPDX-License-Identifier: Apache-2.0

/**
 * Shared record-form geometry for maps that sit under a notebook route.
 * The field app hydrates GIS features and provides this context; Map fields
 * and the overview map read the same collection, layer list, and prefs.
 */

import {createContext} from 'react';
import type {GeoJSONFeature} from './types';
import type {
  RecordFormLayer,
  RecordFormLayerDescriptor,
  RecordFormLayerPatch,
} from './recordFormLayers';

/** Properties tagged onto every extracted feature, tracing it to its record. */
export type RecordFeatureProps = {
  name: string;
  record_id: string;
  revision_id: string;
  form_id: string;
};

/** A parsed GeoJSON feature retagged with its owning record's properties. */
export type RecordGeoJSONFeature = Omit<GeoJSONFeature, 'properties'> & {
  properties: RecordFeatureProps;
};

/** The extracted features of all records, as one GeoJSON FeatureCollection. */
export type RecordFeatureCollection = {
  type: 'FeatureCollection';
  features: RecordGeoJSONFeature[];
};

/**
 * Record-form overlays and the panel actions that mutate their paint.
 * Default is empty so Designer preview and tests without a notebook still
 * render; they must not fetch records.
 */
export type RecordFormMapLayersValue = {
  collection: RecordFeatureCollection | undefined;
  recordLayers: RecordFormLayer[];
  /** Form ids used for stable default colors ({@link getOverviewMapTypes}). */
  overviewMapTypes: string[];
  updateRecordLayer: (id: string, patch: RecordFormLayerPatch) => void;
  resetRecordLayers: () => void;
};

/** No-op value used outside a notebook (Designer preview, isolated tests). */
export const emptyRecordFormMapLayers: RecordFormMapLayersValue = {
  collection: undefined,
  recordLayers: [],
  overviewMapTypes: [],
  updateRecordLayer: () => undefined,
  resetRecordLayers: () => undefined,
};

/** Provided by the field app for the notebook currently on screen. */
export const RecordFormMapLayersContext =
  createContext<RecordFormMapLayersValue>(emptyRecordFormMapLayers);

/**
 * Fingerprint of what is plotted. Keeps collection identity stable across a
 * parent re-render that rebuilt the array, and is the plot-hook effect dep
 * that refreshes vector sources in place (no MapComponent remount).
 *
 * One `record_id:revision_id:form_id` token per feature — do not unique them,
 * or a second GIS field on the same record looks like a no-op. Empty → first
 * geometry already changes the string.
 *
 * Options:
 * - Identity key (this): cheap every render; live add / delete / new revision.
 *   Misses in-place coordinate edits on an already-plotted feature, and a
 *   GIS-field replace that keeps the same feature count.
 * - `JSON.stringify(geometry)`: catches those two cases; serializes every
 *   geometry on every parent render.
 * - Identity + `gisFieldsKey` here: catches a spec field-list change; the
 *   query key already includes `gisFieldsKey`, so the hook re-extracts.
 *
 * Same-revision late AVPs (create, then finish/flush location onto the same
 * id) are not visible in this string until extract runs again. The query key
 * includes `record.updated` for that; tab-away remount still honours
 * staleTime (5 min). Full reload always re-reads.
 *
 * Prefix so an empty plotted collection is not the same key as "no data".
 */
export function recordFeatureSyncKey(
  collection: RecordFeatureCollection | undefined
): string {
  if (!collection) {
    return '';
  }
  return `c:${collection.features
    .map(
      feature =>
        `${feature.properties.record_id}:${feature.properties.revision_id}:${feature.properties.form_id}`
    )
    .join('|')}`;
}

/** True when both collections encode the same records, revisions, and forms. */
export function recordFeatureCollectionsEqual(
  left: RecordFeatureCollection | undefined,
  right: RecordFeatureCollection | undefined
): boolean {
  return recordFeatureSyncKey(left) === recordFeatureSyncKey(right);
}

/** Split a notebook FeatureCollection into one collection per form type. */
export function groupRecordFeaturesByForm(
  collection: RecordFeatureCollection
): Map<string, RecordFeatureCollection> {
  const grouped = new Map<string, RecordGeoJSONFeature[]>();
  for (const feature of collection.features) {
    const formId = feature.properties.form_id;
    if (!formId) {
      continue;
    }
    const list = grouped.get(formId);
    if (list) {
      list.push(feature);
    } else {
      grouped.set(formId, [feature]);
    }
  }
  return new Map(
    [...grouped.entries()].map(([formId, features]) => [
      formId,
      {type: 'FeatureCollection', features},
    ])
  );
}

/**
 * Drop features that belong to `recordId` so an open record's saved geometry
 * is not drawn under the live sketch.
 */
export function excludeRecordFormMapFeatures(
  collection: RecordFeatureCollection | undefined,
  recordId: string | undefined
): RecordFeatureCollection | undefined {
  if (!collection || !recordId) {
    return collection;
  }
  const features = collection.features.filter(
    feature => feature.properties.record_id !== recordId
  );
  if (features.length === collection.features.length) {
    return collection;
  }
  return {type: 'FeatureCollection', features};
}

/**
 * One descriptor per form that has plotted spatial features. Names fall back
 * to the form id when `formName` returns nothing.
 */
export function recordFormLayerDescriptors(
  collection: RecordFeatureCollection | undefined,
  formName: (formId: string) => string,
  formExtents: Record<string, [number, number, number, number]> = {}
): RecordFormLayerDescriptor[] {
  if (!collection) {
    return [];
  }
  const formIds = [
    ...new Set(
      collection.features
        .map(feature => feature.properties.form_id)
        .filter(Boolean)
    ),
  ].sort();
  return formIds.map(formId => ({
    formId,
    name: formName(formId) || formId,
    ...(formExtents[formId] ? {extent4326: formExtents[formId]} : {}),
  }));
}
