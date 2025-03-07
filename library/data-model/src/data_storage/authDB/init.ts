import {InitialisationContent} from '../utils';
import {permissionDocument, viewsDocument} from './design';
import {AuthDatabaseSecurityDocument} from './security';

// currently no config for the auth DB
export type AuthDbInitialisationConfig = {};

export function initAuthDB(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  config: AuthDbInitialisationConfig
): InitialisationContent {
  return {
    designDocuments: [viewsDocument, permissionDocument],
    securityDocument: AuthDatabaseSecurityDocument,
  };
}
