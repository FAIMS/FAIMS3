// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: buildconfig.ts
 * Description:
 *   App configuration is parsed from Vite's `import.meta.env` via
 *   `@faims3/build-config` (`parseAppEnv`). This module keeps only the
 *   address-autosuggest factory and Capacitor platform constants.
 *   Prefer importing `{config}` and reading `config.<field>`.
 */

import {Capacitor} from '@capacitor/core';
import {parseAppEnv} from '@faims3/build-config';
import {
  type IAutosuggestAddressService,
  MapboxAutosuggestAddressService,
  MapTilerAutosuggestAddressService,
  type MapConfig,
} from '@faims3/forms';

const logError = (err: unknown) => console.error(err);

/**
 * Source for address autosuggest service. NONE disables autocomplete; MAPBOX
 * uses Mapbox Search Box API (requires VITE_AUTOSUGGEST_MAPBOX_KEY); MAPTILER
 * uses MapTiler Search and Geocoding API (VITE_AUTOSUGGEST_MAPTILER_KEY, or
 * VITE_MAP_SOURCE_KEY when map source is maptiler).
 */
export enum AutosuggestSource {
  /** No address autosuggest; AddressField uses manual entry only. */
  NONE = 'none',
  /** Mapbox Search Box API (suggest + retrieve). */
  MAPBOX = 'mapbox',
  /** MapTiler Search and Geocoding API (forward + by-id). */
  MAPTILER = 'maptiler',
}

/** App singleton. Prefer `import {config}` and `config.<field>`. */
export const config = parseAppEnv(import.meta.env, {
  appVersion: __APP_VERSION__,
});

export type Config = typeof config;

/** Build the map configuration object consumed by map UI components. */
export function getMapConfig(): MapConfig {
  return config.mapConfig;
}

let addressAutosuggestServiceInstance: IAutosuggestAddressService | null = null;

/** Lazily construct the Mapbox/MapTiler autosuggest client, or `null` if disabled. */
function createAddressAutosuggestServiceInstance(): IAutosuggestAddressService | null {
  if (addressAutosuggestServiceInstance !== null) {
    return addressAutosuggestServiceInstance;
  }
  const source = config.autosuggestSource;
  if (source === AutosuggestSource.NONE) {
    return null;
  }
  if (source === AutosuggestSource.MAPBOX) {
    const apiKey = config.mapboxAccessToken;
    if (!apiKey) {
      logError(
        'VITE_AUTOSUGGEST_SOURCE is MAPBOX but VITE_AUTOSUGGEST_MAPBOX_KEY is not set; address autosuggest disabled.'
      );
      return null;
    }
    addressAutosuggestServiceInstance = new MapboxAutosuggestAddressService({
      apiKey,
      language: 'en',
      limit: 10,
      types: 'address',
      country: config.mapboxAddressCountry,
    });
    return addressAutosuggestServiceInstance;
  }
  if (source === AutosuggestSource.MAPTILER) {
    const apiKey = config.maptilerApiKey;
    if (!apiKey) {
      logError(
        "VITE_AUTOSUGGEST_SOURCE is 'maptiler' but no MapTiler API key available (set VITE_AUTOSUGGEST_MAPTILER_KEY or, when using MapTiler for maps, VITE_MAP_SOURCE_KEY); address autosuggest disabled."
      );
      return null;
    }
    addressAutosuggestServiceInstance = new MapTilerAutosuggestAddressService({
      apiKey,
      language: 'en',
      limit: 10,
      types: ['address'],
      country: config.maptilerAddressCountry,
    });
    return addressAutosuggestServiceInstance;
  }
  return null;
}

/**
 * Returns a factory for the address autosuggest service based on
 * VITE_AUTOSUGGEST_SOURCE and provider-specific env.
 */
export function getAddressAutosuggestService():
  | (() => IAutosuggestAddressService)
  | undefined {
  const instance = createAddressAutosuggestServiceInstance();
  if (instance === null) {
    return undefined;
  }
  return () => instance;
}

/** Always auto-activate notebooks listed by the directory. */
export const AUTOACTIVATE_LISTINGS = true;

/** Max characters shown for root description on the notebook listing page. */
export const NOTEBOOK_LIST_DESCRIPTION_MAX_LENGTH = 50;

/** Native platform reported by Capacitor (`ios` / `android` / `web`). */
export const CAPACITOR_PLATFORM = Capacitor.getPlatform() as
  | 'ios'
  | 'android'
  | 'web';
export const IS_MOBILE_PLATFORM =
  CAPACITOR_PLATFORM === 'ios' || CAPACITOR_PLATFORM === 'android';
export const IS_WEB_PLATFORM = CAPACITOR_PLATFORM === 'web';
