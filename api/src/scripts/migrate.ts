// SPDX-License-Identifier: Apache-2.0
/* eslint-disable n/no-process-exit */
import {startBugsnag} from '../bugsnag';
import {runManualMigration} from '../couchdb/startupMigrations';

/**
 * Main function to run database initialisation and migration.
 *
 * Flags:
 * - `--keys`: also push the JWT public key configuration
 * - `--skip-notebooks`: skip the notebook uiSpec walk and marker
 */
const main = async () => {
  try {
    const pushKeys = process.argv.includes('--keys');
    const skipNotebooks = process.argv.includes('--skip-notebooks');

    console.log(
      `Public keys will ${pushKeys ? '' : 'not '}be configured during migration`
    );
    console.log(
      `Notebook designs will ${skipNotebooks ? 'not ' : ''}be migrated`
    );

    startBugsnag();

    await runManualMigration({pushKeys, skipNotebooks});

    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

// Execute the main function
main();
