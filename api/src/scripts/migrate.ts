// SPDX-License-Identifier: Apache-2.0
/* eslint-disable n/no-process-exit */
import {startBugsnag} from '../bugsnag';
import {initialiseAndMigrateDBs} from '../couchdb';

/**
 * Main function to run database initialisation and migration
 * Accepts optional --keys flag to control whether public keys should be pushed
 */
const main = async () => {
  try {
    // Check if --keys flag is present in command line arguments
    const pushKeys = process.argv.includes('--keys');

    // Log whether keys will be configured
    console.log(
      `Public keys will ${pushKeys ? '' : 'not '}be configured during migration`
    );

    startBugsnag();

    // Manual migrate repairs design/security docs regardless of the db-setup
    // records (boot trusts them)
    await initialiseAndMigrateDBs({
      force: true,
      forceSetup: true,
      pushKeys: pushKeys,
    });

    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

// Execute the main function
main();
