// SPDX-License-Identifier: Apache-2.0

/*
 * Description:
 * Shared types and helpers for the offline map tile store.
 */

export type InitTileDbResult = {
  // True if a failed migration caused the database to be wiped and reset.
  databaseReset: boolean;
};

/**
 * Create a unique id for a user-created offline map.
 *
 * This becomes StoredTileSet.setName internally. The editable user-visible
 * name is stored separately in StoredTileSet.label.
 */
export const OFFLINE_MAP_ID_PREFIX = 'offline-map-';
export function createOfflineMapId(): string {
  return `${OFFLINE_MAP_ID_PREFIX}${crypto.randomUUID()}`;
}
