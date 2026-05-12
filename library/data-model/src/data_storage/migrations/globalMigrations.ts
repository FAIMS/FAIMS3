import {GlobalMigrationDefinition} from './globalMigrationTypes';

/**
 * Cross-database migrations: each entry describes which database types move
 * from which version to which, and a single `run` that receives every matched
 * connection via {@link GlobalMigrationRunContext}.
 *
 * The migration service tries per-database individual steps first; only when no
 * individual step can run for any database that still needs work will it
 * consider entries here, in array order.
 */
export const GLOBAL_MIGRATIONS: GlobalMigrationDefinition[] = [];
