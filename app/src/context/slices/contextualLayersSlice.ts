// SPDX-License-Identifier: Apache-2.0
/**
 * On-device map layer metadata: downloaded file records, paint preferences,
 * and which layer listing a survey has already been shown.
 * File bytes stay in Capacitor Filesystem or the Origin Private File System.
 * redux-persist writes this slice to IndexedDB.
 */

import type {ContextualLayerListing, MapAssetStyle} from '@faims3/data-model';
import {
  configureStore,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';

export type ContextualLayerFile = {
  assetId: string;
  contentHash: string;
  kind: ContextualLayerListing['kind'];
  name: string;
  byteSize: number;
  extent4326: ContextualLayerListing['extent'];
  extent3857?: ContextualLayerListing['extent3857'];
  minZoom?: ContextualLayerListing['minZoom'];
  maxZoom?: ContextualLayerListing['maxZoom'];
  tileSize?: ContextualLayerListing['tileSize'];
  defaultStyle: MapAssetStyle;
  filename: string;
  /** Active surveys that downloaded this file. */
  projectIds: string[];
};

export type ContextualLayerPrefs = {
  visible: boolean;
  opacity: number;
  zIndex: number;
  stroke: string;
  fill: string;
  lineWidth: number;
  pointSize: number;
  labelField?: string;
};

export type ContextualLayersState = {
  files: Record<string, ContextualLayerFile>;
  prefs: Record<string, ContextualLayerPrefs>;
  seenHashByProject: Record<string, string>;
};

export const initialContextualLayersState: ContextualLayersState = {
  files: {},
  prefs: {},
  seenHashByProject: {},
};

const contextualLayersSlice = createSlice({
  name: 'contextualLayers',
  initialState: initialContextualLayersState,
  reducers: {
    replaceContextualLayersState(
      _state,
      action: PayloadAction<ContextualLayersState>
    ) {
      return {
        files: action.payload.files,
        prefs: action.payload.prefs,
        seenHashByProject: action.payload.seenHashByProject,
      };
    },
  },
  extraReducers: builder => {
    builder.addMatcher(
      (action): action is {type: string} => action.type === 'RESET_STORE',
      () => initialContextualLayersState
    );
  },
});

export const {replaceContextualLayersState} = contextualLayersSlice.actions;

export default contextualLayersSlice.reducer;

type LayersStore = {
  getState: () => {contextualLayers: ContextualLayersState};
  dispatch: (action: unknown) => unknown;
};

let boundStore: LayersStore | undefined;

/** The app store calls this after configureStore. Tests can bind their own. */
export function bindContextualLayersStore(store: LayersStore) {
  boundStore = store;
}

function layersStore(): LayersStore {
  if (!boundStore) {
    boundStore = configureStore({
      reducer: {contextualLayers: contextualLayersSlice.reducer},
    });
  }
  return boundStore;
}

export function readContextualLayersState(): ContextualLayersState {
  const {files, prefs, seenHashByProject} =
    layersStore().getState().contextualLayers;
  return structuredClone({
    files,
    prefs,
    seenHashByProject,
  });
}

export function writeContextualLayersState(next: ContextualLayersState) {
  layersStore().dispatch(
    replaceContextualLayersState({
      files: next.files,
      prefs: next.prefs,
      seenHashByProject: next.seenHashByProject,
    })
  );
}
