import {DatabaseInterface} from '../../types';
import {MigrationsDB, MigrationsDBDocument} from '../migrationsDB';
import {DATABASE_TYPE, DatabaseType} from './types';

/**
 * How a participant database is selected when matching a global migration.
 *
 * **Meaning**
 *
 * - `single`: In this `migrateDbs` batch there must be **exactly one** physical
 *   Couch DB of that `dbType` that is still behind its target **and** sitting at
 *   `from`. That one DB is the participant. If two (or zero) match, the global
 *   does not apply—avoids “which directory did we mean?”.
 * - `all-of-type`: **Every** physical DB of that `dbType` in the batch that is
 *   still behind target must be at **the same** `from` version, and **all** of
 *   them are upgraded together in this step. Use when the migration must run
 *   once per logical “slice” of DBs (e.g. every `METADATA` DB in this batch).
 *
 * **How that maps to FAIMS `DatabaseType`**
 *
 * Types that are normally **one Couch DB per server** (directory, projects list,
 * people, invites, templates, auth, …) almost always use `single` for that row:
 * the batch for that `migrateDbs` call contains one handle of that type.
 *
 * Types where **many** Couch DBs exist (one **DATA** and one **METADATA** DB per
 * project) use `all-of-type` when a global step must touch **every** project
 * DB of that type **in the same batch** at once. If you only pass one project’s
 * pair into `migrateDbs`, `all-of-type` means “all METADATA handles in *this*
 * batch”, not literally every project on the server—batch composition defines
 * the set.
 */
export type GlobalMigrationParticipantMultiplicity =
  | 'single'
  | 'all-of-type';

export type GlobalMigrationParticipant = {
  dbType: DATABASE_TYPE;
  from: number;
  to: number;
  multiplicity: GlobalMigrationParticipantMultiplicity;
};

export type LoadedDbHandle = {
  dbType: DatabaseType;
  dbName: string;
  db: DatabaseInterface;
  migrationDoc: MigrationsDBDocument;
};

/**
 * After a global matches, every {@link LoadedDbHandle} grouped by participant
 * `dbType` (each type appears at most once in `definition.participants`).
 */
export type GlobalMigrationMatchedHandles = ReadonlyMap<
  DatabaseType,
  readonly LoadedDbHandle[]
>;

export type GlobalMigrationRunResult =
  | {status: 'success'}
  | {status: 'failure'; issues: string[]};

/**
 * Context passed to {@link GlobalMigrationDefinition.run} for one matched
 * global migration step.
 *
 * Use {@link GlobalMigrationRunContext.handles} or {@link GlobalMigrationRunContext.getUnique}
 * for **participant** types. For any type present in the `migrateDbs` batch
 * (including non-participants such as `PEOPLE`, or every `DATA` / `METADATA`
 * notebook DB), use {@link GlobalMigrationRunContext.allHandlesForType}.
 * Each `dbType` may appear only once in `definition.participants`, so matched
 * lookup is deterministic.
 */
export type GlobalMigrationRunContext = {
  userId: string;
  migrationDb: MigrationsDB;
  definition: GlobalMigrationDefinition;
  /** Matched Couch DBs for each participant `dbType` (same keys as participants). */
  matchedByDbType: GlobalMigrationMatchedHandles;
  /**
   * Handles matched for this participant `dbType` (empty array if that type is
   * not part of this global).
   */
  handles(dbType: DatabaseType): readonly LoadedDbHandle[];
  /**
   * Every {@link LoadedDbHandle} taking part in this global step, deduped by
   * `(dbType, dbName)`.
   */
  allHandles(): LoadedDbHandle[];
  /**
   * The full list passed into `migrateDbs` for this invocation, including DBs
   * that are not part of this global migration (e.g. other projects’ DBs).
   */
  allBatchHandles(): LoadedDbHandle[];
  /**
   * Every handle in the full `migrateDbs` batch with this `dbType` (zero, one,
   * or many physical DBs — e.g. all `DATA` notebooks). Same filter as
   * `allBatchHandles().filter(h => h.dbType === dbType)` with stable order.
   * Use for read-only context DBs or updates that **do not** use that type as
   * a global **participant** (participants use {@link handles} / {@link getUnique}).
   */
  allHandlesForType(dbType: DatabaseType): readonly LoadedDbHandle[];
  /**
   * Same as {@link handles} — retained for readability when filtering by type.
   */
  listByType(dbType: DatabaseType): LoadedDbHandle[];
  /**
   * First matched handle for this `dbType`, or `undefined` if none.
   */
  firstOfType(dbType: DatabaseType): LoadedDbHandle | undefined;
  /**
   * Exactly one matched handle for this `dbType`; throws if there are zero or
   * several (e.g. `all-of-type` with multiple DBs — use {@link handles} instead).
   */
  getUnique(dbType: DatabaseType): LoadedDbHandle;
};

export type GlobalMigrationDefinition = {
  /** Stable id stored on migration logs */
  id: string;
  description: string;
  /**
   * Each `dbType` may appear **at most once**. Order does not affect matching;
   * use {@link GlobalMigrationRunContext.handles}(`dbType`) in `run`.
   */
  participants: GlobalMigrationParticipant[];
  run: (ctx: GlobalMigrationRunContext) => Promise<GlobalMigrationRunResult>;
};
