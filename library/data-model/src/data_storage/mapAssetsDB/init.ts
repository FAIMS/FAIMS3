// SPDX-License-Identifier: Apache-2.0
import {mapAssetsDesignDocuments} from './design';
import {InitialisationContent} from '../utils';
import {MapAssetsDBSecurityDocument} from './security';

export type MapAssetsDBInitialisationConfig = {};

/** Design documents and security for the map-assets Couch database. */
export function initMapAssetsDB(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  config: MapAssetsDBInitialisationConfig
): InitialisationContent {
  return {
    designDocuments: [mapAssetsDesignDocuments.indexDocument],
    securityDocument: MapAssetsDBSecurityDocument,
  };
}
