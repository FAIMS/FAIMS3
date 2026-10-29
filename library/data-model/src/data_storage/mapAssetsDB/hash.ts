// SPDX-License-Identifier: Apache-2.0
import {createHash} from '../utils';

/**
 * SHA-256 of the sorted `assetId:contentHash` pairs for one survey's **ready**
 * layers. Pending or failed linked assets are not in this digest. An empty
 * ready set hashes the empty string so the digest stays stable.
 */
export async function buildContextualLayersHash(
  layers: {id: string; contentHash: string}[]
): Promise<string> {
  const canonical = [...layers]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(layer => `${layer.id}:${layer.contentHash}`)
    .join('\n');
  return createHash(canonical);
}
