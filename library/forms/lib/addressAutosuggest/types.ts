// SPDX-License-Identifier: Apache-2.0

import type {AddressValue} from '@faims3/data-model';

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
