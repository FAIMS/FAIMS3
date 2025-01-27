import {User} from '@/auth';
import {clsx, type ClassValue} from 'clsx';
import {twMerge} from 'tailwind-merge';
import {z} from 'zod';
import type {ZodObject, ZodSchema} from 'zod';

/**
 * cn function is a utility function for creating class names from tailwind classes.
 *
 * @param {...ClassValue} inputs - The tailwind classes to be combined.
 * @returns {string} The combined class names.
 */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/**
 * initials function returns the initials of a name.
 *
 * @param {string} name - The name to extract initials from.
 * @returns {string} The initials of the name.
 */
export const initials = (name: string) => {
  const parts = name.split(' ');
  return parts.map(part => part[0].toUpperCase()).join('');
};

/**
 * capitalize function returns the capitalized version of a string.
 *
 * @param {string} name - The string to capitalize.
 * @returns {string} The capitalized version of the string.
 */
export const capitalize = (name: string) =>
  name.charAt(0).toUpperCase() + name.slice(1);

export const get = async (path: string, user: User) => {
  const response = await fetch(`http://localhost:8080${path}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
  });

  if (!response.ok) throw new Error('Error fetching surveys');

  return await response.json();
};

/**
 * schemaFields function returns an array of field names from a Zod schema.
 *
 * @param {ZodObject<any>} schema - The Zod schema to extract field names from.
 * @returns {Array<keyof z.infer<T>>} An array of field names from the Zod schema.
 */
export function schemaFields<T extends ZodObject<any>>(
  schema: T
): Array<keyof z.infer<T>> {
  return Object.keys(schema.shape) as Array<keyof z.infer<T>>;
}
