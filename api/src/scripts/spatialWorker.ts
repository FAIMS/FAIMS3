// SPDX-License-Identifier: Apache-2.0
/* eslint-disable n/no-process-exit */
/**
 * Spatial worker. Polls the Couch map-asset queue, runs GDAL on one asset
 * at a time, and exits after SPATIAL_WORKER_IDLE_EXIT_MS with no claim.
 * `0` keeps the process running (compose / on-prem).
 *
 * Usage:
 *   pnpm --filter=@faims3/api spatial-worker
 *   node scripts/spatialWorker.js --poll
 *
 * Production image (WORKDIR /app/api/build/src):
 *   node scripts/spatialWorker.js --poll
 */

import {config} from '../buildconfig';
import {waitForCouchDBConnection} from '../couchdb';
import {
  findUnclaimedSpatialJob,
  processMapAsset,
} from '../couchdb/mapAssets/store';
import {runSpatialWorkerLoop} from '../spatial/workerLoop';

/** Print CLI usage and spatial-tool env vars. */
const showHelp = () => {
  console.log(`Usage: node scripts/spatialWorker.js --poll

Poll the Couch map-asset queue and process jobs until idle.

  --poll     Run the drain loop (required)
  -h, --help Show this help

SPATIAL_WORKER_IDLE_EXIT_MS  Exit after this many ms with no job (0 = never)
SPATIAL_WORKER_POLL_MS       Delay between empty polls
GDAL_NUM_THREADS             ALL_CPUS (default) or a positive integer
GDAL_CACHEMAX                Raster block cache, megabytes (default 256)
GDAL_WARP_MEMORY_MB          gdalwarp -wm megabytes (default 256)
GDAL_WARP_MULTI              gdalwarp -multi (default true)
TIPPECANOE_MAX_THREADS       Cap tippecanoe threads (default: all CPUs)
`);
};

/** Parse `--poll`, wait for Couch, then drain jobs until idle. */
const main = async () => {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) {
    showHelp();
    process.exit(0);
  }
  if (args.some(arg => arg !== '--poll')) {
    console.error(`Unknown argument: ${args.find(arg => arg !== '--poll')}`);
    showHelp();
    process.exit(1);
  }
  if (!args.includes('--poll')) {
    console.error('Pass --poll to start the drain loop.');
    showHelp();
    process.exit(1);
  }

  console.log(
    `[spatial-worker] idleExitMs=${config.spatialWorkerIdleExitMs} pollMs=${config.spatialWorkerPollMs} gdalNumThreads=${config.gdalNumThreads} gdalCacheMaxMb=${config.gdalCacheMaxMb} gdalWarpMemoryMb=${config.gdalWarpMemoryMb} gdalWarpMulti=${config.gdalWarpMulti} tippecanoeMaxThreads=${config.tippecanoeMaxThreads ?? 'all'}`
  );
  console.log(`Couch server: ${config.couchdbInternalUrl}`);
  const connection = await waitForCouchDBConnection();
  if (!connection.valid) {
    // Missing databases (pre-migrate) are recoverable: the drain loop
    // treats a failed poll as empty and retries. Unreachable Couch is not.
    if (connection.database_errors?.length) {
      console.warn(
        '[spatial-worker] CouchDB databases not ready yet; polling until they exist'
      );
      for (const e of connection.database_errors) {
        console.warn(`  ${e}`);
      }
    } else {
      console.error('Cannot reach CouchDB. Aborting.');
      console.error(connection.validate_error || connection.server_msg);
      process.exit(1);
    }
  }

  const outcome = await runSpatialWorkerLoop({
    idleExitMs: config.spatialWorkerIdleExitMs,
    pollIntervalMs: config.spatialWorkerPollMs,
    findJob: () => findUnclaimedSpatialJob(),
    processJob: assetId => processMapAsset(assetId),
  });
  console.log(`[spatial-worker] exiting (${outcome})`);
  process.exit(0);
};

main().catch(error => {
  console.error('spatialWorker failed:', error);
  process.exit(1);
});
