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

import type {AddressValue} from '../addressTypes';

/** One suggestion in the autocomplete list (provider-agnostic). */
export interface AutosuggestSuggestion {
  /** Stable id used to fetch full address (e.g. Mapbox mapbox_id). */
  id: string;
  /** Primary line for dropdown (e.g. "110 Franklin St"). */
  displayText: string;
  /** Optional second line (e.g. "Concord, New Hampshire, USA"). */
  secondaryText?: string;
}

/** Options for suggest(); sessionToken groups suggest + getAddressFromSuggestion for billing. */
export interface AutosuggestRequestOptions {
  /** Required for session-based billing (e.g. Mapbox). Same token must be passed to getAddressFromSuggestion. */
  sessionToken: string;
  /** Response language (e.g. "en"). */
  language?: string;
  /** Restrict to countries (ISO 3166-1 alpha-2). */
  country?: string[];
  /** Max suggestions to return (e.g. 10). */
  limit?: number;
  /** Optional AbortSignal to cancel this request when a newer one is started (avoids race conditions). */
  signal?: AbortSignal;
}

/** Options for getAddressFromSuggestion(); use same sessionToken as the suggest() calls. */
export interface GetAddressRequestOptions {
  sessionToken: string;
}

/**
 * Service interface for address autocomplete (suggest-then-select).
 * Implementations (e.g. Mapbox) are configured via their constructor (e.g. apiKey)
 * and injected via FullFormConfig.addressAutosuggestService.
 *
 * Errors (network, invalid id) should reject the promise. Returning null from
 * getAddressFromSuggestion is for "not found" or invalid suggestion id.
 */
export interface IAutosuggestAddressService {
  /**
   * Fetch suggestions for a partial query (e.g. "110 frankli").
   * Used to populate the dropdown. Session token groups suggest + later
   * getAddressFromSuggestion for billing (e.g. Mapbox).
   */
  suggest(
    query: string,
    options: AutosuggestRequestOptions
  ): Promise<AutosuggestSuggestion[]>;

  /**
   * Resolve a selected suggestion (by id) to a full address in the app's
   * format. Must be called with the same sessionToken as the suggest calls
   * that produced the suggestion.
   */
  getAddressFromSuggestion(
    suggestionId: string,
    options: GetAddressRequestOptions
  ): Promise<AddressValue | null>;
}
