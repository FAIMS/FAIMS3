import {Feature} from 'ol';
import TileLayer from 'ol/layer/Tile';
import {OSM} from 'ol/source';

/**
 * Coordinates in WGS84 (EPSG:4326) format.
 * [longitude, latitude]
 */
export type Coordinates = [number, number];

/**
 * Bounding box extent in WGS84 (EPSG:4326) format.
 * [minLon, minLat, maxLon, maxLat]
 */
export type WGS84Extent = [number, number, number, number];

/**
 * Provider interface for tile sources.
 *
 * Implement this interface to provide custom tile layers, such as:
 * - Offline-capable tile stores
 * - Alternative tile providers (Mapbox, Google, etc.)
 * - Custom styling or overlays
 *
 * @example
 * ```typescript
 * const myProvider: TileSourceProvider = {
 *   getTileLayer: () => new TileLayer({ source: new XYZ({ url: '...' }) }),
 *   getAttribution: () => '© My Provider',
 *   mapCacheIncludes: async (features) => {
 *     // Check if cached tiles cover the features' extent
 *     return await myCache.coversExtent(features);
 *   },
 * };
 * ```
 */
export interface TileSourceProvider {
  /**
   * Creates and returns the tile layer for the map.
   *
   * This is called once during map initialisation. The returned layer
   * should be fully configured with its source and any styling.
   *
   * @returns A configured OpenLayers TileLayer
   */
  getTileLayer(): TileLayer<OSM>;

  /**
   * Returns the attribution HTML string for the tile source.
   *
   * This is displayed at the bottom of the map. Should include
   * appropriate copyright notices for the tile provider.
   *
   * @returns HTML string for attribution display
   */
  getAttribution(): string;

  /**
   * Checks if cached tiles cover the extent of the given features.
   *
   * This is optional and only needed for offline support. When implemented,
   * it enables `canShowMapNear` to determine if the map can be displayed
   * when offline.
   *
   * @param features - Array of OpenLayers Features to check coverage for
   * @returns Promise resolving to true if cache covers the features' extent
   */
  mapCacheIncludes?(features: Feature[]): Promise<boolean>;
}
