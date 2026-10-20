// SPDX-License-Identifier: Apache-2.0
/* eslint-disable n/no-process-exit */
/**
 * Bridge between the Couch map-asset queue and worker capacity.
 *
 * Reads pending and processing jobs that already have originals and asks the configured
 * capacity provider to start workers when there are not enough. Never stops
 * a worker — idle workers exit on their own.
 *
 * Usage:
 *   pnpm --filter=@faims3/api capacity-manager
 *
 * Production image (WORKDIR /app/api/build/src):
 *   node scripts/capacityManager.js
 */

import {config} from '../buildconfig';
import {waitForCouchDBConnection} from '../couchdb';
import {summarizeSpatialBacklog} from '../couchdb/mapAssets/store';
import {createCapacityProvider} from '../services/capacityProvider';
import {reconcileCapacity} from '../spatial/reconcileCapacity';

/** Resolve after `ms` milliseconds. */
const sleep = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

const provider = createCapacityProvider({
  serviceType: config.capacityProviderType,
  fixedReplicas: config.capacityFixedReplicas,
  ecs: config.capacityEcs,
});

/** One reconcile pass: read the Couch backlog and start workers if needed. */
async function tick(): Promise<void> {
  const backlog = await summarizeSpatialBacklog();
  const result = await reconcileCapacity({
    provider,
    inFlight: backlog.inFlight,
    unclaimed: backlog.unclaimed,
    max: config.capacityMax,
    scaleThresholds: config.capacityScaleThresholds,
  });
  console.log(
    `[capacity] inFlight=${backlog.inFlight} unclaimed=${backlog.unclaimed} needed=${result.needed} ensured=${result.ensured}`
  );
}

/** Wait for Couch, then reconcile forever at `capacityReconcileMs`. */
const main = async () => {
  console.log(
    `[capacity] provider=${config.capacityProviderType} max=${config.capacityMax} scale=${config.capacityScaleThresholds.join(',')} reconcileMs=${config.capacityReconcileMs}`
  );
  console.log(`Couch server: ${config.couchdbInternalUrl}`);
  const connection = await waitForCouchDBConnection();
  if (!connection.valid) {
    console.error('Cannot reach CouchDB. Aborting.');
    console.error(connection.validate_error || connection.server_msg);
    if (connection.database_errors?.length) {
      for (const e of connection.database_errors) {
        console.error(`  ${e}`);
      }
    }
    process.exit(1);
  }

  for (;;) {
    try {
      await tick();
    } catch (error) {
      console.error('[capacity] reconcile failed', error);
    }
    await sleep(config.capacityReconcileMs);
  }
};

main().catch(error => {
  console.error('capacityManager failed:', error);
  process.exit(1);
});
