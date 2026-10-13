// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: index.ts
 * Description:
 *   API for accessing data from the GUI. The GUI should not use internals.ts,
 *   instead wrapper functions should be provided here.
 */

/**
 * The Data Storage module provides an API for accessing data from the GUI.
 * @module data_storage
 * @category Database
 */

// Files
export * from './attachments';
export * from './internals';
export * from './merging';
export * from './queries';
export * from './storageFunctions';
export * from './updatedTimeFilter';
export * from './utils';

// Nested folders
export * from './authDB';
export * from './dataDB';
export * from './directoryDB';
export * from './invitesDB';
export * from './migrations';
export * from './migrationsDB';
export * from './peopleDB';
export * from './rootMetadata';
export * from './projectsDB';
export * from './teamsDB';
export * from './templatesDB';
export * from './tombstoneDB';
