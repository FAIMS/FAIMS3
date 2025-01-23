import {User} from '@/auth';
import {clsx, type ClassValue} from 'clsx';
import {twMerge} from 'tailwind-merge';
import {z} from 'zod';
import type {ZodObject, ZodSchema} from 'zod';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const initials = (name: string) => {
  const parts = name.split(' ');
  return parts.map(part => part[0].toUpperCase()).join('');
};

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

export function schemaFields<T extends ZodObject<any>>(
  schema: T
): Array<keyof z.infer<T>> {
  return Object.keys(schema.shape) as Array<keyof z.infer<T>>;
}
