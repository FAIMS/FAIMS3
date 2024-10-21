/**
 * This module provides an enhanced fetch utility and an API client manager for
 * making authenticated HTTP requests to multiple cluster endpoints. It wraps
 * the JWT handling from the listing object as well as making error handling
 * more consistent.
 */

import {ListingsObject} from '@faims3/data-model/src/types';
import {getAllListingIDs, getListing} from '../../sync/state';
import {getTokenForCluster} from '../../users';

/** Supported HTTP methods */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/** Extended fetch options interface */
interface FetchOptions extends CustomOptions {
  method?: HttpMethod;
  body?: any;
}

/**
 * Custom error class for HTTP errors
 */
class HttpError extends Error {
  /**
   * @param response - The Response object from the failed fetch
   * @param message - Optional error message
   */
  constructor(public response: Response) {
    const message = `Status: ${response.status} ${response.statusText}`;
    super(message);
    this.name = 'HttpError';
  }

  /**
   * Override toString() method
   * @returns A string representation of the HttpError
   */
  toString(): string {
    return `Status: ${this.response.status} ${this.response.statusText}`;
  }
}

/**
 * Enhanced fetch utility for making authenticated HTTP requests which uses the
 * ListingObject to prepend the endpoint, add JSON headers, and auth.
 */
export class ListingFetch {
  private listing: ListingsObject;

  /**
   * @param listing - The ListingsObject containing API information
   */
  constructor(listing: ListingsObject) {
    this.listing = listing;
  }

  /**
   * Retrieves authentication headers for the request
   * @returns Promise resolving to Headers object with auth token
   * @throws Error if no token is available for the cluster
   */
  private async getAuthHeaders(options: CustomOptions): Promise<{}> {
    if (options.useToken ?? true) {
      const jwt_token = await getTokenForCluster(this.listing.id);
      if (!jwt_token) {
        throw new Error('No token available for this cluster.');
      }
      return {
        Authorization: `Bearer ${jwt_token}`,
        'Content-Type': 'application/json',
      };
    }

    return {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Makes an HTTP request to the specified endpoint
   * @param endpoint - The API endpoint to request
   * @param options - Request options
   * @returns Promise resolving to the JSON response
   * @throws HttpError if the response is not OK
   */
  private async request<T>(
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<T> {
    // Prepend the conductor URL
    const url = `${this.listing.conductor_url}${endpoint}`;
    // Include auth headers
    const headers = await this.getAuthHeaders(options);

    // Include user options
    const fetchOptions: RequestInit = {
      ...options,
      headers: {...headers, ...options.headers},
    };

    // Stringify the body if present
    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    // Make request
    const response = await fetch(url, fetchOptions);

    // Throw error if not OK
    if (!response.ok) {
      const errorText = await response.text();
      console.log('HTTP Error occurred.');
      console.log(`Status: ${response.status}`);
      console.log(`Text: ${errorText}`);
      throw new HttpError(response);
    }

    // Return JSON
    return await response.json();
  }

  /**
   * Performs a GET request
   * @param endpoint - The API endpoint
   * @param options - Additional request options
   */
  async get<T>(
    endpoint: string,
    options: Omit<FetchOptions, 'method'> = {}
  ): Promise<T> {
    return this.request<T>(endpoint, {...options, method: 'GET'});
  }

  /**
   * Performs a POST request
   * @param endpoint - The API endpoint
   * @param body - The request body
   * @param options - Additional request options
   */
  async post<T>(
    endpoint: string,
    body: any,
    options: Omit<FetchOptions, 'method' | 'body'> = {}
  ): Promise<T> {
    return this.request<T>(endpoint, {...options, method: 'POST', body});
  }

  /**
   * Performs a PUT request
   * @param endpoint - The API endpoint
   * @param body - The request body
   * @param options - Additional request options
   */
  async put<T>(
    endpoint: string,
    body: any,
    options: Omit<FetchOptions, 'method' | 'body'> = {}
  ): Promise<T> {
    return this.request<T>(endpoint, {...options, method: 'PUT', body});
  }

  /**
   * Performs a DELETE request
   * @param endpoint - The API endpoint
   * @param options - Additional request options
   */
  async delete<T>(
    endpoint: string,
    options: Omit<FetchOptions, 'method'> = {}
  ): Promise<T> {
    return this.request<T>(endpoint, {...options, method: 'DELETE'});
  }

  /**
   * Performs a PATCH request
   * @param endpoint - The API endpoint
   * @param body - The request body
   * @param options - Additional request options
   */
  async patch<T>(
    endpoint: string,
    body: any,
    options: Omit<FetchOptions, 'method' | 'body'> = {}
  ): Promise<T> {
    return this.request<T>(endpoint, {...options, method: 'PATCH', body});
  }
}

type CustomOptions = RequestInit & {useToken?: boolean};

/**
 * Manages multiple API clients for different listings - maintains a simple map
 *
 * //TODO @luke-mcfarlane-rocketlab replace with context management for listings
 * i.e. pass in the context object and it will handle it
 */
export class ListingFetchManager {
  private clients: Map<string, ListingFetch> = new Map();
  private listingsMap: Map<string, ListingsObject> = new Map();

  /**
   * Retrieves or creates a client for a given listing ID
   * @param listingId - The ID of the listing
   * @returns client for the specified listing
   * @throws Error if no listing is found for the given ID
   */
  private getOrCreateClient(listingId: string): ListingFetch {
    // Do we already have a client?
    if (this.clients.has(listingId)) {
      // If so provide it
      return this.clients.get(listingId)!;
    }

    // Try to get the listing
    let listing = this.listingsMap.get(listingId);

    // If it doesn't exist, let's rebuild things
    // TODO context management
    if (!listing) {
      console.debug(
        `No listing found for ID: ${listingId}. Fetching from listing DB and refreshing.`
      );
      const ids = getAllListingIDs();
      ids.forEach(id => {
        // Get the record
        const listingObj = getListing(id);

        // Update our local record
        this.listingsMap.set(id, listingObj.listing);

        // If the id matches then set the particular listing
        if (id === listingId) {
          listing = listingObj.listing;
        }
      });
    }

    if (!listing) {
      throw new Error(
        `Failed to find the listing with id ${listingId} even after rebuilding the list from local state. Unable to build client.`
      );
    }

    // Okay - all good to return the client now
    const client = new ListingFetch(listing);
    this.clients.set(listingId, client);
    return client;
  }

  /**
   * Performs a GET request for a specific listing
   * @param listingId - The ID of the listing
   * @param endpoint - The API endpoint
   * @param options - Additional request options
   */
  async get<T>(
    listingId: string,
    endpoint: string,
    options?: CustomOptions
  ): Promise<T> {
    const client = this.getOrCreateClient(listingId);
    return client.get<T>(endpoint, options);
  }

  /**
   * Performs a POST request for a specific listing
   * @param listingId - The ID of the listing
   * @param endpoint - The API endpoint
   * @param body - The request body
   * @param options - Additional request options
   */
  async post<T>(
    listingId: string,
    endpoint: string,
    body: any,
    options?: CustomOptions
  ): Promise<T> {
    const client = this.getOrCreateClient(listingId);
    return client.post<T>(endpoint, body, options);
  }

  /**
   * Performs a PUT request for a specific listing
   * @param listingId - The ID of the listing
   * @param endpoint - The API endpoint
   * @param body - The request body
   * @param options - Additional request options
   */
  async put<T>(
    listingId: string,
    endpoint: string,
    body: any,
    options?: CustomOptions
  ): Promise<T> {
    const client = this.getOrCreateClient(listingId);
    return client.put<T>(endpoint, body, options);
  }

  /**
   * Performs a DELETE request for a specific listing
   * @param listingId - The ID of the listing
   * @param endpoint - The API endpoint
   * @param options - Additional request options
   */
  async delete<T>(
    listingId: string,
    endpoint: string,
    options?: CustomOptions
  ): Promise<T> {
    const client = this.getOrCreateClient(listingId);
    return client.delete<T>(endpoint, options);
  }

  /**
   * Performs a PATCH request for a specific listing
   * @param listingId - The ID of the listing
   * @param endpoint - The API endpoint
   * @param body - The request body
   * @param options - Additional request options
   */
  async patch<T>(
    listingId: string,
    endpoint: string,
    body: any,
    options?: CustomOptions
  ): Promise<T> {
    const client = this.getOrCreateClient(listingId);
    return client.patch<T>(endpoint, body, options);
  }

  /**
   * Checks if a client exists for a given listing ID
   * @param listingId - The ID of the listing
   * @returns boolean indicating whether a client exists
   */
  hasClient(listingId: string): boolean {
    return this.clients.has(listingId);
  }

  /**
   * Retrieves all listing IDs
   * @returns Array of listing IDs
   */
  getListingIds(): string[] {
    return Array.from(this.listingsMap.keys());
  }

  /**
   * Updates or adds a new listing
   * @param listing - The ListingsObject to update or add
   */
  updateListing(listing: ListingsObject): void {
    this.listingsMap.set(listing.id, listing);
    // If a client already exists for this listing, update it
    if (this.clients.has(listing.id)) {
      this.clients.set(listing.id, new ListingFetch(listing));
    }
  }

  /**
   * Removes a listing and its associated client
   * @param listingId - The ID of the listing to remove
   */
  removeListing(listingId: string): void {
    this.listingsMap.delete(listingId);
    this.clients.delete(listingId);
  }
}

// Export fetch manager
const FetchManager = new ListingFetchManager();
export default FetchManager;
