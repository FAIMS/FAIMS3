/* eslint-disable n/no-process-exit */

import {restoreFromBackup} from '../couchdb/backupRestore';

const main = async () => {
  if (process.argv.length === 4) {
    const filename = process.argv[2];
    const pattern = process.argv[3];
    console.log(`Restoring from ${filename} with pattern ${pattern}`);
    restoreFromBackup({filename, pattern});
  } else {
    console.log('Usage: node restoreBackup.ts <filename> <pattern>');
    process.exit(1);
  }
};

main();
