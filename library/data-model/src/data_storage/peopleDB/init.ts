import {InitialisationContent} from '../utils';
import {PeopleDBSecurityDocument} from './security';

export type PeopleDBInitialisationConfig = {};
export function initPeopleDB({}: PeopleDBInitialisationConfig): InitialisationContent {
  return {
    designDocuments: [],
    securityDocument: PeopleDBSecurityDocument,
  };
}
