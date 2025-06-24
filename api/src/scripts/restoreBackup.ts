/* eslint-disable n/no-process-exit */

import {restoreFromBackup} from '../couchdb/backupRestore';

const main = async () => {
  if (process.argv.length >= 4) {
    const filename = process.argv[2];
    const pattern = process.argv[3];
    const force = process.argv[4] === 'true';
    console.log(
      `Restoring from ${filename} with pattern ${pattern}, force=${force}`
    );
    restoreFromBackup({filename, pattern, force});
  } else {
    console.log('Usage: node restoreBackup.ts <filename> <pattern> ?<force>');
    console.log(' * pattern is a regex pattern to filter databases to restore');
    console.log(
      ' * last argument is "true" to force overwrite of existing documents, default is false'
    );
    process.exit(1);
  }
};

main();
