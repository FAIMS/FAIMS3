import {User} from '@/context/auth-provider';
import {clsx, type ClassValue} from 'clsx';
import {twMerge} from 'tailwind-merge';
import {z} from 'zod';
import type {ZodObject} from 'zod';

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

/**
 * readFileAsText function reads a file as text and returns a promise with the file contents.
 *
 * @param {File} file - The file to read.
 * @returns {Promise<string>} A promise that resolves to the file contents.
 */
export const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result as string);
    };

    reader.onerror = reject;

    reader.readAsText(file);
  });

/**
 * Pauses execution for a given number of milliseconds.
 * @param {number} ms - The number of milliseconds to sleep.
 * @returns {Promise<void>} A promise that resolves after the specified duration.
 */
export async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * downloadFile function downloads a file from a URL.
 *
 * @param {string} filename - The name of the file to download.
 * @param {Blob | MediaSource} obj - The object to download.
 */
export const downloadFile = async (
  obj: Blob | MediaSource,
  filename: string
) => {
  const link = document.createElement('a');

  link.href = window.URL.createObjectURL(obj);
  link.download = filename;

  link.click();
};
