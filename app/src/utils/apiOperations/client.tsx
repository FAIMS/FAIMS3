import {Server} from '../../context/slices/projectSlice';
import {store} from '../../context/store';

/** Supported HTTP methods */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/** Extended fetch options interface */
interface FetchOptions extends CustomOptions {
  method?: HttpMethod;
  body?: any;
}

/** Custom error class for HTTP errors */
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
 * ListingObject to prepend the endpoint, add JSON headers, and auth from the auth store.
 */
export class ListingFetch {
  private server: Server;
  private username: string;

  /**
   * @param server - The ListingsObject containing API information
   * @param username - The username to authenticate as for this listing
   */
  constructor(server: Server, username: string) {
    this.server = server;
    this.username = username;
  }

  /**
   * Retrieves authentication headers for the request from the auth store
   * @returns Headers object with auth token
   * @throws Error if no token is available for the listing/user combination
   */
  private getAuthHeaders(options: CustomOptions): {} {
    if (options.useToken ?? true) {
      const authState = store.getState().auth;
      const tokenInfo =
        authState.servers[this.server.serverId]?.users[this.username];

      if (!tokenInfo) {
        throw new Error(
          'No token available for this listing/user combination.'
        );
      }

      return {
        Authorization: `Bearer ${tokenInfo.token}`,
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
    const url = `${this.server.serverUrl}${endpoint}`;
    const headers = this.getAuthHeaders(options);

    const fetchOptions: RequestInit = {
      ...options,
      headers: {...headers, ...options.headers},
    };

    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('HTTP Error occurred.');
      console.log(`Status: ${response.status}`);
      console.log(`Text: ${errorText}`);
      throw new HttpError(response);
    }

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
 * Manages multiple API clients for different listing/user combinations
 */
export class ListingFetchManager {
  private clients: Map<string, Map<string, ListingFetch>> = new Map();
  private serverMap: Map<string, Server> = new Map();

  /**
   * Retrieves or creates a client for a given listing ID and username
   * @param serverId - The ID of the listing
   * @param username - The username to authenticate as
   * @returns client for the specified listing/user combination
   * @throws Error if no listing is found for the given ID
   */
  private getOrCreateClient(serverId: string, username: string): ListingFetch {
    let serverClients = this.clients.get(serverId);
    if (serverClients?.has(username)) {
      return serverClients.get(username)!;
    }

    let server = this.serverMap.get(serverId);
    if (!server) {
      const servers = store.getState().projects.servers;
      const ids = Object.keys(servers);
      ids.forEach(id => {
        const serverObj = servers[id];
        this.serverMap.set(id, serverObj);
        if (id === serverId) {
          server = serverObj;
        }
      });
    }

    if (!server) {
      throw new Error(`Failed to find server with id ${serverId}`);
    }

    const client = new ListingFetch(server, username);
    if (!serverClients) {
      serverClients = new Map();
      this.clients.set(serverId, serverClients);
    }
    serverClients.set(username, client);
    return client;
  }

  /**
   * Performs a GET request for a specific listing/user combination
   * @param listingId - The ID of the listing
   * @param username - The username to authenticate as
   * @param endpoint - The API endpoint
   * @param options - Additional request options
   */
  async get<T>(
    listingId: string,
    username: string,
    endpoint: string,
    options?: CustomOptions
  ): Promise<T> {
    const client = this.getOrCreateClient(listingId, username);
    return client.get<T>(endpoint, options);
  }

  /**
   * Performs a POST request for a specific listing/user combination
   * @param listingId - The ID of the listing
   * @param username - The username to authenticate as
   * @param endpoint - The API endpoint
   * @param body - The request body
   * @param options - Additional request options
   */
  async post<T>(
    listingId: string,
    username: string,
    endpoint: string,
    body: any,
    options?: CustomOptions
  ): Promise<T> {
    const client = this.getOrCreateClient(listingId, username);
    return client.post<T>(endpoint, body, options);
  }

  /**
   * Performs a PUT request for a specific listing/user combination
   * @param listingId - The ID of the listing
   * @param username - The username to authenticate as
   * @param endpoint - The API endpoint
   * @param body - The request body
   * @param options - Additional request options
   */
  async put<T>(
    listingId: string,
    username: string,
    endpoint: string,
    body: any,
    options?: CustomOptions
  ): Promise<T> {
    const client = this.getOrCreateClient(listingId, username);
    return client.put<T>(endpoint, body, options);
  }

  /**
   * Performs a DELETE request for a specific listing/user combination
   * @param listingId - The ID of the listing
   * @param username - The username to authenticate as
   * @param endpoint - The API endpoint
   * @param options - Additional request options
   */
  async delete<T>(
    listingId: string,
    username: string,
    endpoint: string,
    options?: CustomOptions
  ): Promise<T> {
    const client = this.getOrCreateClient(listingId, username);
    return client.delete<T>(endpoint, options);
  }

  /**
   * Performs a PATCH request for a specific listing/user combination
   * @param listingId - The ID of the listing
   * @param username - The username to authenticate as
   * @param endpoint - The API endpoint
   * @param body - The request body
   * @param options - Additional request options
   */
  async patch<T>(
    listingId: string,
    username: string,
    endpoint: string,
    body: any,
    options?: CustomOptions
  ): Promise<T> {
    const client = this.getOrCreateClient(listingId, username);
    return client.patch<T>(endpoint, body, options);
  }

  /**
   * Checks if a client exists for a given listing ID and username
   * @param listingId - The ID of the listing
   * @param username - The username to check for
   * @returns boolean indicating whether a client exists
   */
  hasClient(listingId: string, username: string): boolean {
    return !!this.clients.get(listingId)?.has(username);
  }

  /**
   * Retrieves all listing IDs
   * @returns Array of listing IDs
   */
  getListingIds(): string[] {
    return Array.from(this.serverMap.keys());
  }

  /**
   * Updates or adds a new listing
   * @param server - The ListingsObject to update or add
   */
  updateListing(server: Server): void {
    this.serverMap.set(server.serverId, server);
    const listingClients = this.clients.get(server.serverId);
    if (listingClients) {
      listingClients.forEach((_, username) => {
        listingClients.set(username, new ListingFetch(server, username));
      });
    }
  }

  /**
   * Removes a listing and its associated clients
   * @param listingId - The ID of the listing to remove
   */
  removeListing(listingId: string): void {
    this.serverMap.delete(listingId);
    this.clients.delete(listingId);
  }
}

// Export fetch manager singleton
const FetchManager = new ListingFetchManager();
export default FetchManager;
