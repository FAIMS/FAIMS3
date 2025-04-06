import {InitialisationContent, teamsDesignDocuments} from '..';
import {TeamsDBSecurityDocument} from './security';

export type TeamsDBInitialisationConfig = {};
export function initTeamsDB(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  config: TeamsDBInitialisationConfig
): InitialisationContent {
  return {
    designDocuments: [teamsDesignDocuments.designDoc],
    securityDocument: TeamsDBSecurityDocument,
  };
}
