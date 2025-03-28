import {initialiseAndMigrateDBs} from '../couchdb';

const main = async () => {
  try {
    await initialiseAndMigrateDBs({force: true});
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

main();
