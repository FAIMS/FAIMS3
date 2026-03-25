/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type {AddressType, AddressValue} from '../addressTypes';
import type {
  AutosuggestRequestOptions,
  AutosuggestSuggestion,
  GetAddressRequestOptions,
  IAutosuggestAddressService,
} from './types';

const MAPTILER_GEOCODING_BASE = 'https://api.maptiler.com/geocoding';

/** Configuration for the MapTiler address autosuggest implementation. */
export interface MapTilerAutosuggestConfig {
  /** MapTiler API key (required). */
  apiKey: string;
  /** Response language (e.g. "en"). */
  language?: string;
  /** Restrict to countries (ISO 3166-1 alpha-2). */
  country?: string[];
  /** Max suggestions per request (default 10). */
  limit?: number;
  /** Filter types of features to return (e.g. address, place). */
  types?: string[];
}

/** MapTiler Geocoding API Feature (subset we use). */
interface MapTilerFeature {
  id: string;
  type: string;
  text?: string;
  place_name?: string;
  address?: string;
  place_type?: string[];
  center?: [number, number];
  context?: MapTilerContext[];
  properties?: {country_code?: string; kind?: string};
  geometry?: {type: string; coordinates: [number, number]};
}

/** MapTiler context item in feature hierarchy (id, text, kind,
 * place_designation). */
interface MapTilerContext {
  id: string;
  text?: string;
  kind?: string;
  place_designation?: string;
  country_code?: string;
}

/** MapTiler SearchResults (FeatureCollection). */
interface MapTilerSearchResults {
  type: string;
  features?: MapTilerFeature[];
}

/**
 * Maps a MapTiler API feature into structured address fields. Implements the
 * {@link AddressType} shape from addressTypes (GeocodeJSON-style).
 */
function buildAddressFromMapTilerFeature(
  feature: MapTilerFeature
): AddressType {
  const ctx = feature.context ?? [];
  const isAddress =
    feature.properties?.kind === 'street' ||
    feature.place_type?.includes('address');
  const road =
    isAddress && feature.text?.trim() ? feature.text.trim() : undefined;
  const suburbCtx = ctx.find(c => c.place_designation === 'suburb');
  const townCtx =
    ctx.find(c => c.place_designation === 'town') ??
    ctx.find(c => c.place_designation === 'city') ??
    ctx.find(c => c.kind === 'place');
  const stateCtx = ctx.find(c => c.place_designation === 'state');
  const postcodeCtx = ctx.find(c => c.id.startsWith('postal_code.'));
  const countryCtx = ctx.find(c => c.place_designation === 'country');
  return {
    house_number: feature.address?.trim() || undefined,
    road: road || undefined,
    suburb: suburbCtx?.text?.trim() || undefined,
    town: townCtx?.text?.trim() || undefined,
    state: stateCtx?.text?.trim() || undefined,
    postcode: postcodeCtx?.text?.trim() || undefined,
    country: countryCtx?.text?.trim() || undefined,
    country_code:
      feature.properties?.country_code?.toUpperCase() ||
      countryCtx?.country_code?.toUpperCase() ||
      undefined,
  };
}

/**
 * Converts a MapTiler feature to {@link AddressValue}.
 */
function mapTilerFeatureToAddressValue(feature: MapTilerFeature): AddressValue {
  const address = buildAddressFromMapTilerFeature(feature);
  const displayName =
    feature.place_name?.trim() ||
    feature.text?.trim() ||
    [
      address.house_number,
      address.road,
      address.suburb,
      address.state,
      address.postcode,
    ]
      .filter(Boolean)
      .join(', ') ||
    'Unknown address';
  return {display_name: displayName, address};
}

/**
 * MapTiler Geocoding API implementation of {@link IAutosuggestAddressService}.
 * Returns {@link AddressValue} / {@link AddressType} from addressTypes. Uses
 * forward geocoding for suggest; caches last suggest() and resolves from cache
 * when possible (by-ID endpoint lacks house number and full context).
 */
export class MapTilerAutosuggestAddressService implements IAutosuggestAddressService {
  private readonly config: MapTilerAutosuggestConfig;
  /** Cache of last suggest() features by id; used so we don't rely on the by-ID
   * API which lacks house number and full context. */
  private lastSuggestFeaturesById = new Map<string, MapTilerFeature>();

  /** Creates the service with the given config; requires a non-empty apiKey. */
  constructor(config: MapTilerAutosuggestConfig) {
    if (!config.apiKey?.trim()) {
      throw new Error(
        'MapTilerAutosuggestAddressService requires a non-empty apiKey'
      );
    }
    this.config = {limit: 10, ...config};
  }

  /** Suggests addresses for a query; results can be resolved to
   * {@link AddressValue} via {@link getAddressFromSuggestion}. */
  async suggest(
    query: string,
    options: AutosuggestRequestOptions
  ): Promise<AutosuggestSuggestion[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }
    const params = new URLSearchParams({
      key: this.config.apiKey,
      limit: String(options.limit ?? this.config.limit ?? 10),
      autocomplete: 'true',
    });
    if (this.config.language ?? options.language) {
      params.set('language', options.language ?? this.config.language ?? 'en');
    }
    if (options.country?.length ?? this.config.country?.length) {
      const country = options.country ?? this.config.country ?? [];
      if (country.length > 0) {
        params.set('country', country.join(','));
      }
    }
    if (this.config.types?.length) {
      params.set('types', this.config.types.join(','));
    }

    const url = `${MAPTILER_GEOCODING_BASE}/${encodeURIComponent(trimmed)}.json?${params.toString()}`;
    const res = await fetch(url, {signal: options.signal});
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `MapTiler geocoding failed: ${res.status} ${res.statusText} - ${text}`
      );
    }
    const data = (await res.json()) as MapTilerSearchResults;
    const features = data.features ?? [];

    this.lastSuggestFeaturesById.clear();
    for (const f of features) {
      this.lastSuggestFeaturesById.set(f.id, f);
    }

    return features.map(
      (f): AutosuggestSuggestion => ({
        id: f.id,
        displayText: f.text ?? f.place_name ?? '',
        secondaryText: f.place_name && f.text ? f.place_name : undefined,
      })
    );
  }

  /** Resolves a suggestion id to a full {@link AddressValue}, or
   * null if not found. */
  async getAddressFromSuggestion(
    suggestionId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    options: GetAddressRequestOptions
  ): Promise<AddressValue | null> {
    const cached = this.lastSuggestFeaturesById.get(suggestionId);
    if (cached) {
      return mapTilerFeatureToAddressValue(cached);
    }
    const params = new URLSearchParams({key: this.config.apiKey});
    if (this.config.language) {
      params.set('language', this.config.language);
    }
    const encodedId = encodeURIComponent(suggestionId);
    const url = `${MAPTILER_GEOCODING_BASE}/${encodedId}.json?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) {
        return null;
      }
      const text = await res.text();
      throw new Error(
        `MapTiler geocoding (by id) failed: ${res.status} ${res.statusText} - ${text}`
      );
    }
    const data = (await res.json()) as MapTilerSearchResults;
    const feature = data.features?.[0];
    if (!feature) {
      return null;
    }
    return mapTilerFeatureToAddressValue(feature);
  }
}
