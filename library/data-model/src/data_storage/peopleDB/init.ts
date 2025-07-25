import {peopleDesignDocuments} from './design';
import {InitialisationContent} from '../utils';
import {PeopleDBSecurityDocument} from './security';

export type PeopleDBInitialisationConfig = {};
export function initPeopleDB(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  config: PeopleDBInitialisationConfig
): InitialisationContent {
  return {
    designDocuments: [peopleDesignDocuments.designDoc],
    securityDocument: PeopleDBSecurityDocument,
  };
}
