import {InitialisationContent} from '../utils';
import {permissionDocument, viewsDocument} from './design';
import {AuthDatabaseSecurityDocument} from './security';

// currently no config for the auth DB
export type AuthDbInitialisationConfig = {};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function initAuthDB(
  config: AuthDbInitialisationConfig
): InitialisationContent {
  return {
    designDocuments: [viewsDocument, permissionDocument],
    securityDocument: AuthDatabaseSecurityDocument,
  };
}
