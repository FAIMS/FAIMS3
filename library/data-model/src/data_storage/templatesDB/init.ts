// SPDX-License-Identifier: Apache-2.0
import {InitialisationContent} from '../utils';
import {templatesDbDesignDocuments} from './design';
import {TemplatesDBSecurityDocument} from './security';

export type TemplatesDBInitialisationConfig = {};
/**
 * Templates DB design docs include listing views keyed so GET /api/templates
 * can seek by `_id` (and team + archive flag). Updating the map functions
 * requires this initialiser to rewrite `_design/index`.
 */
export function initTemplatesDB(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  config: TemplatesDBInitialisationConfig
): InitialisationContent {
  return {
    designDocuments: [templatesDbDesignDocuments.indexDocument],
    securityDocument: TemplatesDBSecurityDocument,
  };
}
