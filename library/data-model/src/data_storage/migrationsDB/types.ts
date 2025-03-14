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
 * Filename: src/datamodel/users.ts
 * Description:
 *   Data models related to users.
 */

import {DATABASE_TYPE} from '../migrations';

export type MigrationLog = {
  // from and to version ID
  from: number;
  to: number;

  // Any notes about this migration?
  notes?: string;

  // MS timestamp started at
  startedAtTimestampMs: number;
  // MS timestamp completed at
  completedAtTimestampMs: number;

  // User ID of the token who launched this
  launchedBy: string;

  // Status and issues
  status: 'success' | 'failure';
  issues?: string[];
};

export type MigrationsDBFields = {
  // Which type of database is this referring to
  dbType: DATABASE_TYPE;
  // The fully qualified db name (i.e. uniquely specifies the actual database
  // within this couch instance)
  dbName: string;
  // What version is this database at - that we know of?
  version: number;
  // Do we suspect that the DB is healthy?
  status: 'healthy' | 'not-healthy';
  // History of migrations
  migrationLog: MigrationLog[];
};
export type MigrationsDBDocument =
  PouchDB.Core.ExistingDocument<MigrationsDBFields>;
export type MigrationsDB = PouchDB.Database<MigrationsDBFields>;
