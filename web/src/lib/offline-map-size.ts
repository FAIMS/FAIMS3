/**
 * Web re-exports for offline map size helpers and the large-area warning threshold.
 *
 * {@link LARGE_OFFLINE_MAP_AREA_MB} matches the Control Centre confirmation
 * dialog in {@link ../components/tabs/project/offline-map.tsx}.
 */
export {
  estimateOfflineMapRegionSizeMb as estimateOfflineMapAreaSizeMb,
  formatOfflineMapSizeMb,
  formatOfflineMapSizeBytes,
} from '@faims3/forms';

/** Size (MB) above which Control Centre asks for extra confirmation before saving. */
export const LARGE_OFFLINE_MAP_AREA_MB = 100;
