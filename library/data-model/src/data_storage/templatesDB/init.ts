import {InitialisationContent} from '../utils';
import {TemplatesDBSecurityDocument} from './security';

export type TemplatesDBInitialisationConfig = {};
export function initTemplatesDB({}: TemplatesDBInitialisationConfig): InitialisationContent {
  return {
    designDocuments: [],
    securityDocument: TemplatesDBSecurityDocument,
  };
}
