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
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
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
export * from './migrations';
export * from './utils';

// Nested folders
export * from './authDB';
export * from './dataDB';
export * from './directoryDB';
export * from './metadataDB';
export * from './migrationsDB';
export * from './peopleDB';
export * from './projectsDB';
export * from './templatesDB';
export * from './invitesDB';
