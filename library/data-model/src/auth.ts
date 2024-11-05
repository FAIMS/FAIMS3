import {z} from 'zod';

// =========
// CONSTANTS
// =========

export const CLUSTER_ADMIN_GROUP_NAME = 'cluster-admin';
export const NOTEBOOK_CREATOR_GROUP_NAME = 'notebook-creator';

// =====
// TYPES
// =====

export const ADMIN_GROUP_NAMES_SCHEMA = z.enum([
  CLUSTER_ADMIN_GROUP_NAME,
  NOTEBOOK_CREATOR_GROUP_NAME,
]);

export type ADMIN_GROUP_NAMES = z.infer<typeof ADMIN_GROUP_NAMES_SCHEMA>;
