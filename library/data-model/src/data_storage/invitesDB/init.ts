import {InitialisationContent} from '../utils';
import {invitesDesignDocuments} from './design';
import {InvitesDBSecurityDocument} from './security';

export type InvitesDBInitialisationConfig = {};
export function initInvitesDB(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  config: InvitesDBInitialisationConfig
): InitialisationContent {
  return {
    // some common indexes
    designDocuments: [invitesDesignDocuments.designDoc],
    securityDocument: InvitesDBSecurityDocument,
  };
}
