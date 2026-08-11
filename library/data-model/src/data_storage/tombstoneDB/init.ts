import {tombstoneDesignDocuments} from './design';
import {InitialisationContent} from '../utils';
import {TombstoneDBSecurityDocument} from './security';

export type TombstoneDBInitialisationConfig = {};
export function initTombstoneDB(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  config: TombstoneDBInitialisationConfig
): InitialisationContent {
  return {
    designDocuments: [tombstoneDesignDocuments.designDoc],
    securityDocument: TombstoneDBSecurityDocument,
  };
}
