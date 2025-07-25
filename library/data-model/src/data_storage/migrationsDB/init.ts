import {InitialisationContent} from '../utils';
import {migrationDbDesignDocuments} from './design';
import {MigrationsDBSecurityDocument} from './security';

export type MigrationsDBInitialisationConfig = {};
export function initMigrationsDB(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  config: MigrationsDBInitialisationConfig
): InitialisationContent {
  return {
    // key indexes by properties in the DB
    designDocuments: [migrationDbDesignDocuments.indexDocument],
    securityDocument: MigrationsDBSecurityDocument,
  };
}
