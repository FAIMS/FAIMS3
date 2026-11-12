// SPDX-License-Identifier: Apache-2.0
/** Authenticated JSON `GET` / `POST` against the Conductor API. */
import {config} from '@/constants';
import type {User} from '@/context/auth-provider';

/**
 * post function is a utility function for making POST requests to the API.
 *
 * @param {string} path - The path to the API endpoint.
 * @param {User | null} user - The user object.
 * @returns {Promise<any>} A promise that resolves to the response data.
 */
export const post = async <TPayload, TResponse>({
  user,
  data,
  path,
}: {
  path: string;
  data: TPayload;
  user: User;
}) => {
  const response = await fetch(`${config.apiUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) throw new Error(response.statusText);

  return (await response.json()) as TResponse;
};

/**
 * get function is a utility function for making GET requests to the API.
 *
 * @param {string} path - The path to the API endpoint.
 * @param {User | null} user - The user object.
 * @returns {Promise<any>} A promise that resolves to the response data.
 */
export const get = async <T = any>(
  path: string,
  user: User | null,
  token: string | null = null
) => {
  if (!user && !token) throw new Error('Not authenticated');

  const response = await fetch(`${config.apiUrl}${path}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user ? user.token : token}`,
    },
  });

  if (!response.ok) throw new Error(response.statusText);

  return (await response.json()) as T;
};
