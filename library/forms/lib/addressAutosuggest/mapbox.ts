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

const MAPBOX_SUGGEST_BASE =
  'https://api.mapbox.com/search/searchbox/v1/suggest';
const MAPBOX_RETRIEVE_BASE =
  'https://api.mapbox.com/search/searchbox/v1/retrieve';

/** Configuration for the Mapbox address autosuggest implementation. */
export interface MapboxAutosuggestConfig {
  /** Mapbox access token (required). */
  apiKey: string;
  /** Response language (e.g. "en"). */
  language?: string;
  /** Restrict to countries (ISO 3166-1 alpha-2). */
  country?: string[];
  /** Max suggestions per request (default 10). */
  limit?: number;
  /** Restrict to feature types (e.g. "address" for addresses only). */
  types?: string;
}

/** Mapbox suggest API response (subset we use). */
interface MapboxSuggestResponse {
  suggestions?: MapboxSuggestion[];
}

interface MapboxSuggestion {
  mapbox_id: string;
  name?: string;
  address?: string;
  full_address?: string;
  place_formatted?: string;
  context?: MapboxContext;
}

interface MapboxContext {
  country?: {name?: string; country_code?: string};
  region?: {name?: string; region_code?: string};
  postcode?: {name?: string};
  district?: {name?: string};
  place?: {name?: string};
  locality?: {name?: string};
  neighborhood?: {name?: string};
  address?: {address_number?: string; street_name?: string; name?: string};
  street?: {name?: string};
}

/** Mapbox retrieve API response (GeoJSON FeatureCollection subset). */
interface MapboxRetrieveResponse {
  type?: string;
  features?: MapboxFeature[];
}

interface MapboxFeature {
  type?: string;
  geometry?: {coordinates?: [number, number]; type?: string};
  properties?: {
    mapbox_id?: string;
    name?: string;
    address?: string;
    full_address?: string;
    place_formatted?: string;
    context?: MapboxContext;
  };
}

function buildAddressFromContext(ctx: MapboxContext | undefined): AddressType {
  if (!ctx) {
    return {};
  }
  const addressPart = ctx.address;
  const road =
    addressPart?.street_name ??
    addressPart?.name ??
    ctx.street?.name ??
    undefined;
  return {
    house_number: addressPart?.address_number,
    road: road || undefined,
    suburb: ctx.neighborhood?.name ?? ctx.locality?.name,
    town: ctx.place?.name,
    state: ctx.region?.name,
    postcode: ctx.postcode?.name,
    country: ctx.country?.name,
    country_code: ctx.country?.country_code,
  };
}

function mapboxSuggestionToAddressValue(
  fullAddress: string | undefined,
  placeFormatted: string | undefined,
  ctx: MapboxContext | undefined
): AddressValue {
  const address = buildAddressFromContext(ctx);
  const displayName =
    fullAddress?.trim() ||
    [
      address.house_number,
      address.road,
      address.suburb,
      address.state,
      address.postcode,
    ]
      .filter(Boolean)
      .join(', ') ||
    placeFormatted ||
    'Unknown address';
  return {display_name: displayName, address};
}

/**
 * Mapbox Search Box API implementation of IAutosuggestAddressService.
 * Uses /suggest and /retrieve endpoints with session tokens for billing.
 */
export class MapboxAutosuggestAddressService
  implements IAutosuggestAddressService
{
  private readonly config: MapboxAutosuggestConfig;

  constructor(config: MapboxAutosuggestConfig) {
    if (!config.apiKey?.trim()) {
      throw new Error(
        'MapboxAutosuggestAddressService requires a non-empty apiKey'
      );
    }
    this.config = {
      limit: 10,
      ...config,
    };
  }

  async suggest(
    query: string,
    options: AutosuggestRequestOptions
  ): Promise<AutosuggestSuggestion[]> {
    const params = new URLSearchParams({
      q: query.trim(),
      access_token: this.config.apiKey,
      session_token: options.sessionToken,
    });
    if (this.config.language ?? options.language) {
      params.set('language', options.language ?? this.config.language ?? 'en');
    }
    if (this.config.limit ?? options.limit) {
      params.set('limit', String(options.limit ?? this.config.limit ?? 10));
    }
    if (this.config.types) {
      params.set('types', this.config.types);
    }
    if (options.country?.length ?? this.config.country?.length) {
      const country = options.country ?? this.config.country ?? [];
      if (country.length > 0) {
        params.set('country', country.join(','));
      }
    }

    const url = `${MAPBOX_SUGGEST_BASE}?${params.toString()}`;
    const res = await fetch(url, {signal: options.signal});
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Mapbox suggest failed: ${res.status} ${res.statusText} - ${text}`
      );
    }
    const data = (await res.json()) as MapboxSuggestResponse;
    const suggestions = data.suggestions ?? [];

    return suggestions.map(
      (s): AutosuggestSuggestion => ({
        id: s.mapbox_id,
        displayText: s.address ?? s.name ?? '',
        secondaryText: s.place_formatted,
      })
    );
  }

  async getAddressFromSuggestion(
    suggestionId: string,
    options: GetAddressRequestOptions
  ): Promise<AddressValue | null> {
    const encodedId = encodeURIComponent(suggestionId);
    const params = new URLSearchParams({
      access_token: this.config.apiKey,
      session_token: options.sessionToken,
    });
    if (this.config.language) {
      params.set('language', this.config.language);
    }

    const url = `${MAPBOX_RETRIEVE_BASE}/${encodedId}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) {
        return null;
      }
      const text = await res.text();
      throw new Error(
        `Mapbox retrieve failed: ${res.status} ${res.statusText} - ${text}`
      );
    }
    const data = (await res.json()) as MapboxRetrieveResponse;
    const feature = data.features?.[0];
    if (!feature?.properties) {
      return null;
    }

    const props = feature.properties;
    const ctx = props.context;
    const addressValue = mapboxSuggestionToAddressValue(
      props.full_address,
      props.place_formatted,
      ctx
    );
    return addressValue;
  }
}
