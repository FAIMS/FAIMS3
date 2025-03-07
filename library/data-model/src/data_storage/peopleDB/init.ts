import {InitialisationContent} from '../';
import {PeopleDBSecurityDocument} from './security';

export type PeopleDBInitialisationConfig = {};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function initPeopleDB(
  config: PeopleDBInitialisationConfig
): InitialisationContent {
  return {
    designDocuments: [],
    securityDocument: PeopleDBSecurityDocument,
  };
}
