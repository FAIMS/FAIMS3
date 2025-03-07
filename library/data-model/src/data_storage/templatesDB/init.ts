import {InitialisationContent} from '../utils';
import {TemplatesDBSecurityDocument} from './security';

export type TemplatesDBInitialisationConfig = {};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function initTemplatesDB(
  config: TemplatesDBInitialisationConfig
): InitialisationContent {
  return {
    designDocuments: [],
    securityDocument: TemplatesDBSecurityDocument,
  };
}
