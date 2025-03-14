import {InitialisationContent} from '..';
import {InvitesDBSecurityDocument} from './security';

export type InvitesDBInitialisationConfig = {};
export function initInvitesDB(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  config: InvitesDBInitialisationConfig
): InitialisationContent {
  return {
    designDocuments: [],
    securityDocument: InvitesDBSecurityDocument,
  };
}
