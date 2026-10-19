// SPDX-License-Identifier: Apache-2.0

/**
 * Per-form record geometry layers on the notebook overview map.
 * Paint prefs are stored per project so hide/show and style survive reloads.
 */

import type {ContextualMapLayerPatch} from './contextualMapLayers';
import {
  contextualLayerZIndex,
  RECORD_FORM_LAYER_Z_INDEX_BASE,
} from './layerStack';

export const RECORD_FORM_LAYER_KIND = 'record-form' as const;
export type RecordFormLayerKind = typeof RECORD_FORM_LAYER_KIND;

const RECORD_FORM_LAYER_ID_PREFIX = 'record-form:';
const RECORD_FORM_PREFS_KEY_PREFIX = 'map-record-form-prefs:';

/** Distinct default colors for form types, assigned by stable form-id order. */
export const RECORD_FORM_LAYER_COLORS = [
  '#2171b5',
  '#cb181d',
  '#238b45',
  '#6a51a3',
  '#d94801',
  '#0c2c84',
  '#e7298a',
  '#006d2c',
  '#8856a7',
  '#dd3497',
];

export type RecordFormLayerPrefs = {
  visible: boolean;
  opacity: number;
  zIndex: number;
  stroke: string;
  fill: string;
  lineWidth: number;
  pointSize: number;
  labelField?: string;
};

export type RecordFormLayersPrefsState = Record<string, RecordFormLayerPrefs>;

export type RecordFormLayer = RecordFormLayerPrefs & {
  id: string;
  formId: string;
  name: string;
  kind: RecordFormLayerKind;
  extent4326?: [number, number, number, number];
};

export type RecordFormLayerPatch = ContextualMapLayerPatch;

export type RecordFormLayerDescriptor = {
  formId: string;
  name: string;
  extent4326?: [number, number, number, number];
};

/** Stable overlay id for one form's record geometry. */
export function recordFormLayerId(formId: string): string {
  return `${RECORD_FORM_LAYER_ID_PREFIX}${formId}`;
}

/** Form id encoded in a record-form overlay id, if the prefix matches. */
export function formIdFromRecordFormLayerId(id: string): string | undefined {
  if (!id.startsWith(RECORD_FORM_LAYER_ID_PREFIX)) {
    return undefined;
  }
  const formId = id.slice(RECORD_FORM_LAYER_ID_PREFIX.length);
  return formId.length > 0 ? formId : undefined;
}

/** localStorage key for one project's record-form paint prefs. */
export function recordFormLayerPrefsKey(projectId: string): string {
  return `${RECORD_FORM_PREFS_KEY_PREFIX}${projectId}`;
}

function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(1, Math.max(0, value));
}

function clampZIndex(value: number): number {
  return contextualLayerZIndex(value);
}

function clampPositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function colorForForm(formId: string, colorFormIds: string[]): string {
  const sorted = [...colorFormIds].sort();
  const index = Math.max(0, sorted.indexOf(formId));
  return RECORD_FORM_LAYER_COLORS[index % RECORD_FORM_LAYER_COLORS.length];
}

/** Default visibility, stack, and color for one form overlay. */
export function defaultRecordFormLayerPrefs(
  formId: string,
  colorFormIds: string[],
  stackIndex: number
): RecordFormLayerPrefs {
  const stroke = colorForForm(formId, colorFormIds);
  return {
    visible: true,
    opacity: 1,
    zIndex: RECORD_FORM_LAYER_Z_INDEX_BASE + stackIndex,
    stroke,
    fill: `${stroke}80`,
    lineWidth: 4,
    pointSize: 7,
  };
}

/** Clamp a stored prefs object onto a complete form-overlay paint. */
export function normalizeRecordFormLayerPrefs(
  value: Partial<RecordFormLayerPrefs> | undefined,
  fallback: RecordFormLayerPrefs
): RecordFormLayerPrefs {
  const labelField =
    typeof value?.labelField === 'string' && value.labelField.length > 0
      ? value.labelField
      : fallback.labelField;
  return {
    visible:
      typeof value?.visible === 'boolean' ? value.visible : fallback.visible,
    opacity: clampOpacity(value?.opacity ?? fallback.opacity),
    zIndex: clampZIndex(value?.zIndex ?? fallback.zIndex),
    stroke:
      typeof value?.stroke === 'string' && value.stroke.length > 0
        ? value.stroke
        : fallback.stroke,
    fill:
      typeof value?.fill === 'string' && value.fill.length > 0
        ? value.fill
        : fallback.fill,
    lineWidth: clampPositive(value?.lineWidth ?? fallback.lineWidth, 4),
    pointSize: clampPositive(value?.pointSize ?? fallback.pointSize, 7),
    ...(labelField ? {labelField} : {}),
  };
}

/** Keep only well-formed per-form prefs from a stored map. */
export function normalizeRecordFormLayersPrefsState(
  value: unknown
): RecordFormLayersPrefsState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const next: RecordFormLayersPrefsState = {};
  for (const [id, prefs] of Object.entries(
    value as Record<string, Partial<RecordFormLayerPrefs>>
  )) {
    const formId = formIdFromRecordFormLayerId(id);
    if (!formId || !prefs || typeof prefs !== 'object') {
      continue;
    }
    next[id] = normalizeRecordFormLayerPrefs(
      prefs,
      defaultRecordFormLayerPrefs(formId, [formId], 0)
    );
  }
  return next;
}

/** Read this project's record-form paint prefs from localStorage. */
export function readRecordFormLayerPrefs(
  projectId: string
): RecordFormLayersPrefsState {
  try {
    const stored = localStorage.getItem(recordFormLayerPrefsKey(projectId));
    if (stored) {
      return normalizeRecordFormLayersPrefsState(JSON.parse(stored));
    }
  } catch {
    // Missing or malformed JSON falls through to empty prefs.
  }
  return {};
}

/** Persist this project's record-form paint prefs. */
export function writeRecordFormLayerPrefs(
  projectId: string,
  state: RecordFormLayersPrefsState
): void {
  try {
    localStorage.setItem(
      recordFormLayerPrefsKey(projectId),
      JSON.stringify(normalizeRecordFormLayersPrefsState(state))
    );
  } catch {
    // Private browsing / quota. In-memory prefs still apply for this session.
  }
}

/** Apply a visibility, stack, or paint patch to one form overlay. */
export function applyRecordFormLayerPatch(
  state: RecordFormLayersPrefsState,
  id: string,
  patch: RecordFormLayerPatch,
  fallback: RecordFormLayerPrefs
): RecordFormLayersPrefsState {
  if (!formIdFromRecordFormLayerId(id)) {
    return state;
  }
  return {
    ...state,
    [id]: normalizeRecordFormLayerPrefs({...state[id], ...patch}, fallback),
  };
}

/** Push stored prefs onto an OpenLayers record-form layer. */
export function applyRecordFormLayerPaint(
  layer: {
    setVisible: (visible: boolean) => void;
    setOpacity: (opacity: number) => void;
    setZIndex: (zIndex: number) => void;
  },
  prefs: RecordFormLayerPrefs
): void {
  layer.setVisible(prefs.visible);
  layer.setOpacity(clampOpacity(prefs.opacity));
  layer.setZIndex(clampZIndex(prefs.zIndex));
}

/** Strip listing fields so only paint prefs remain. */
export function prefsFromRecordFormLayer(
  layer: RecordFormLayer
): RecordFormLayerPrefs {
  return {
    visible: layer.visible,
    opacity: layer.opacity,
    zIndex: layer.zIndex,
    stroke: layer.stroke,
    fill: layer.fill,
    lineWidth: layer.lineWidth,
    pointSize: layer.pointSize,
    ...(layer.labelField ? {labelField: layer.labelField} : {}),
  };
}

/**
 * Merge stored paint with defaults for each form that has spatial records.
 * `colorFormIds` is the notebook's overview-map form list so colors stay
 * stable when a form has no features in the current collection.
 */
export function buildRecordFormLayers(
  forms: RecordFormLayerDescriptor[],
  prefs: RecordFormLayersPrefsState,
  colorFormIds: string[]
): RecordFormLayer[] {
  return forms.map((form, index) => {
    const id = recordFormLayerId(form.formId);
    const defaults = defaultRecordFormLayerPrefs(
      form.formId,
      colorFormIds,
      index
    );
    const paint = normalizeRecordFormLayerPrefs(prefs[id], defaults);
    return {
      id,
      formId: form.formId,
      name: form.name,
      kind: RECORD_FORM_LAYER_KIND,
      ...paint,
      ...(form.extent4326 ? {extent4326: form.extent4326} : {}),
    };
  });
}
