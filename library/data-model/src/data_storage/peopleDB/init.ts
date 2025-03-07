import {InitialisationContent} from '../';
import {PeopleDBSecurityDocument} from './security';

export type PeopleDBInitialisationConfig = {};
export function initPeopleDB(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  config: PeopleDBInitialisationConfig
): InitialisationContent {
  return {
    designDocuments: [],
    securityDocument: PeopleDBSecurityDocument,
  };
}
