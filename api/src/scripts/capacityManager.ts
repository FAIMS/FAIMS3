// SPDX-License-Identifier: Apache-2.0
/* eslint-disable n/no-process-exit */
/**
 * Bridge between the Couch map-asset queue and worker capacity.
 *
 * Reads processing jobs that already have originals and asks the configured
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
import {verifyCouchDBConnection} from '../couchdb';
import {summarizeSpatialBacklog} from '../couchdb/mapAssets/store';
import {createCapacityProvider} from '../services/capacityProvider';
import {reconcileCapacity} from '../spatial/reconcileCapacity';

const sleep = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

const provider = createCapacityProvider({
  serviceType: config.capacityProviderType,
  fixedReplicas: config.capacityFixedReplicas,
  ecs: config.capacityEcs,
});

async function tick(): Promise<void> {
  const backlog = await summarizeSpatialBacklog();
  const result = await reconcileCapacity({
    provider,
    inFlight: backlog.inFlight,
    unclaimed: backlog.unclaimed,
    max: config.capacityMax,
  });
  console.log(
    `[capacity] inFlight=${backlog.inFlight} unclaimed=${backlog.unclaimed} needed=${result.needed} ensured=${result.ensured}`
  );
}

const main = async () => {
  console.log(
    `[capacity] provider=${config.capacityProviderType} max=${config.capacityMax} reconcileMs=${config.capacityReconcileMs}`
  );
  console.log(`Couch server: ${config.couchdbInternalUrl}`);
  const connection = await verifyCouchDBConnection();
  if (!connection.valid) {
    console.error('Cannot reach CouchDB. Aborting.');
    console.error(connection.validate_error || connection.server_msg);
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
