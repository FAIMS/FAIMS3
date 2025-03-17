/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Description:
 *   Implements a tile source for Open Street Map tiles that can cache
 * tiles locally.
 */

import {containsCoordinate, containsExtent, Extent} from 'ol/extent';
import Feature, {FeatureLike} from 'ol/Feature';
import MVT from 'ol/format/MVT';
import TileLayer from 'ol/layer/Tile';
import VectorTileLayer from 'ol/layer/VectorTile';
import {LoaderOptions} from 'ol/source/DataTile';
import ImageTileSource from 'ol/source/ImageTile';
import OSM, {ATTRIBUTION} from 'ol/source/OSM';
import VectorTileSource from 'ol/source/VectorTile';
import {TileCoord} from 'ol/tilecoord';
import VectorTile from 'ol/VectorTile';
import {MAP_SOURCE, MAP_SOURCE_KEY, MAP_STYLE} from '../../../buildconfig';
import {applyStyle} from 'ol-mapbox-style';
import {getMapStylesheet} from './styles';
import Tile from 'ol/Tile';
import {IDBObjectStore} from './IDBObjectStore';
import {useIsOnline} from '../../../utils/customHooks';
import {Geometry} from 'ol/geom';

// Table of map tile sources for raster and vector tiles
// based on configuration settings we select which of these to use
//
const TILE_URL_MAP: {[key: string]: {[key: string]: string}} = {
  osm: {
    raster: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    vector: 'https://tile.openstreetmap.org/data/{z}/{x}/{y}.pbf',
  },
  maptiler: {
    raster:
      'https://api.maptiler.com/maps/outdoor-v2/{z}/{x}/{y}.png?key={key}',
    vector: 'https://api.maptiler.com/tiles/v3/{z}/{x}/{y}.pbf?key={key}',
  },
};

// Types stored in the map tile database
// StoredTile is the raw tile cache, basically a URL and the blob
// returned when we request it.  The sets property records which
// tile-sets this belongs to so that when we're deleting sets
// we don't remove this stored tile if it belongs to another one as well
interface StoredTile {
  url: string;
  data: Blob;
  sets: string[];
}

// StoreTileSet is a collection of stored tiles. We record the extent and the min/max
// zoom levels.  The size is calculated after download and cached for future reporting.
// the expected tile count is stored to be able to show the progress loading bar
// tileKeys references the individual StoredTile records.
export interface StoredTileSet {
  setName: string;
  extent: number[];
  minZoom: number;
  maxZoom: number;
  size: number;
  expectedTileCount: number;
  created: Date;
  tileKeys: IDBValidKey[];
}

// MapTileDatabase - a singleton class holding the tile database references
// manages creation of the IndexedDB database and object stores.  Used by TileStoreBase
// to access the stored tiles and tile-sets.
// We initialise this at the start of the app lifecycle to be sure that it will
// be available by the time the user arrives on a map page.
export class MapTileDatabase {
  static #instance: MapTileDatabase;
  // The database is a static member of this class, there is only
  // one connection to the DB in the app
  static DB_NAME = 'tiles_db';
  static db: IDBDatabase;
  // references to the individual object stores within the database
  tileDB!: IDBObjectStore<StoredTile>;
  tileSetDB!: IDBObjectStore<StoredTileSet>;

  constructor() {
    this.initDB();
  }

  static getInstance(): MapTileDatabase {
    if (!MapTileDatabase.#instance) {
      MapTileDatabase.#instance = new MapTileDatabase();
    }
    return MapTileDatabase.#instance;
  }

  // Initialise the database and the two object stores that we'll rely on
  // called from the constructor but could also be awaited by a client if
  // they wanted to ensure that the db is ready
  initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      // incrementing the version number will allow update to the schema
      const DB_VERSION = 1;
      const request = indexedDB.open(MapTileDatabase.DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      // fired on every run, call makeDatabases to initialise this object
      request.onsuccess = () => {
        this.makeDatabases(request.result);
        resolve();
      };
      // event fired after the initial creation of the database, here we
      // create the object stores. Note we also call makeDatabases because this
      // method runs before onsuccess above but only when DB_NAME doesn't exist
      request.onupgradeneeded = (event: any) => {
        if (event.target) {
          const db = event.target.result;
          this.makeDatabases(db);
          if (this.tileDB) this.tileDB.createObjectStore();
          if (this.tileSetDB) this.tileSetDB.createObjectStore();
        }
      };
    });
  }

  // Make the individual databases (object stores) that will store the individual
  // tile/tileSet records
  makeDatabases(db: IDBDatabase) {
    MapTileDatabase.db = db;
    if (!this.tileDB) {
      console.log('creating tile store');
      this.tileDB = new IDBObjectStore<StoredTile>(db, 'tiles', ['url']);
    }
    if (!this.tileSetDB)
      this.tileSetDB = new IDBObjectStore<StoredTileSet>(db, 'tileSets', [
        'setName',
      ]);
  }
}

/**
 * class TileStoreBase
 *  Base functionality for the tile cache that implements downloading and storing
 *  map tiles, checking the tile store before hitting the network, and downloading
 *  and storing tiles in bulk for a given region.
 *
 * Used by VectorTileStore and ImageTileStore to implement two kinds of map
 * tile sources.
 */
class TileStoreBase {
  tileStore: MapTileDatabase;

  constructor() {
    this.tileStore = MapTileDatabase.getInstance();
  }

  /**
   * Store a tile in the database
   * @returns the key of the tile in the database
   */
  async storeTileRecord(url: string, data: Blob, set: string) {
    const tile = {url, data, sets: [set]};
    const existingTile = await this.tileStore.tileDB.get(url);
    if (existingTile) {
      tile.sets = [...existingTile.sets, set];
    }
    const tileKey = await this.tileStore.tileDB.put(tile);
    const size = tile.data.size;
    return {tileKey, size};
  }

  /**
   * Get the URL template we should use for tiles
   * Will be implemented by the derived class.
   *
   * @returns the configured tile URL template
   */
  getTileURLTemplate(): string | undefined {
    return undefined;
  }

  /**
   * Get the URL given a set of tile coordinates
   *
   * @param {z, x, y} tile coordinates
   * @returns The URL for this tile
   */
  getURLForTile({
    z,
    x,
    y,
  }: {
    z: number;
    x: number;
    y: number;
  }): string | undefined {
    const urlTemplate = this.getTileURLTemplate();
    if (urlTemplate) {
      return urlTemplate
        .replace('{z}', z.toString())
        .replace('{x}', x.toString())
        .replace('{y}', y.toString())
        .replace('{key}', MAP_SOURCE_KEY);
    }
  }

  /**
   * Get the blob for a given tile URL, try the cache first or try to download
   * if we are online.
   *
   * @param url Tile URL
   * @returns A blob from the cache or the network or `undefined` if we can't find it
   */
  async getTileBlob(url: string | undefined): Promise<Blob | undefined> {
    if (url) {
      if (this.tileStore.tileDB) {
        const image = await this.tileStore.tileDB.get([url]);
        if (image) return image.data;
      }
      if (navigator.onLine) {
        const response = await fetch(url);
        return await response.blob();
      }
    }
    // fallback, we can't get the tile - offline or no url
    return undefined;
  }

  /**
   * Get the tile grid, will be overridden by subclasses but
   * here git the generic OSM grid
   *
   * @return the tile grid
   */
  getTileGrid() {
    const osm = new OSM();
    return osm.getTileGrid();
  }

  /**
   * estimateSizeForRegion
   *
   * Estimates the size of a region in MB.
   * @param {Extent} extent The extent of the region to estimate the size of.
   * @param {number} minZoom The minimum zoom level to estimate the size of.
   * @param {number} maxZoom The maximum zoom level to estimate the size of.
   * @return {Promise<number>} The estimated size of the region in MB.
   */
  async estimateSizeForRegion(
    extent: Extent,
    minZoom: number,
    maxZoom: number
  ) {
    const tileGrid = this.getTileGrid();
    const averageSize = 100; // kb

    const tileSet = new Set<string>();
    // start at zoom 10, two less than our default zoom level for showing maps
    const startZoom = 10;
    for (let zoom = startZoom; zoom <= maxZoom; zoom += 1) {
      tileGrid?.forEachTileCoord(
        extent,
        Math.ceil(zoom),
        ([z, x, y]: number[]) => {
          tileSet.add(`${z}|${x}|${y}`);
        }
      );
    }
    const counter = tileSet.size;
    const estimatedSize = Math.round((counter * averageSize) / 1024);
    console.log(
      'estimated size',
      Math.round(estimatedSize * 1000) / 1000,
      'MB, ',
      counter,
      'tiles'
    );
    return estimatedSize;
  }

  /**
   * createTileSet - create a tile set that will be used to cache tiles
   *
   * @param extent The extent of the region to get tiles for
   * @param minZoom Minimum zoom level to download
   * @param maxZoom Maximum zoom level to download
   * @param setName The name of the set to store the tiles in
   */
  async createTileSet(
    extent: Extent,
    minZoom: number,
    maxZoom: number,
    setName: string
  ) {
    const existingTileSet = await this.tileStore.tileSetDB.get([setName]);
    if (existingTileSet) {
      throw new Error(
        `Offline map '${setName}' already exists, please choose a different name`
      );
    }
    // create a record for this region
    const tileSet: StoredTileSet = {
      setName,
      extent,
      minZoom: 10,
      maxZoom,
      size: 0,
      expectedTileCount: 0,
      created: new Date(),
      tileKeys: [],
    };
    this.tileStore.tileSetDB.put(tileSet);

    return tileSet;
  }

  /**
   * downloadTileSet - download tiles for a tileSet if not already cached
   *   this can take a long time so is separated from the creation of the
   *   tileset above
   *
   * @param extent The extent of the region to get tiles for
   * @param minZoom Minimum zoom level to download
   * @param maxZoom Maximum zoom level to download
   * @param setName The name of the set to store the tiles in
   */
  async downloadTileSet(setName: string) {
    const tileSet = await this.tileStore.tileSetDB.get([setName]);
    if (!tileSet) {
      throw new Error(`No offline map '${setName}' found`);
    }

    const tileGrid = this.getTileGrid();
    const tileCoords: number[][] = [];
    for (let zoom = tileSet.minZoom; zoom <= tileSet.maxZoom; zoom += 1) {
      tileGrid?.forEachTileCoord(
        tileSet.extent,
        Math.ceil(zoom),
        (tileCoord: TileCoord) => {
          tileCoords.push(tileCoord);
        }
      );
    }

    // update the record with the tile count
    tileSet.expectedTileCount = tileCoords.length;
    this.tileStore.tileSetDB.put(tileSet);

    // Create batches of downloads to avoid overwhelming the browser
    const BATCH_SIZE = 10;
    for (let i = 0; i < tileCoords.length; i += BATCH_SIZE) {
      const batch = tileCoords.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async tileCoord => {
          const [z, x, y] = tileCoord;
          const url = this.getURLForTile({z, x, y});
          const tileBlob = await this.getTileBlob(url);

          if (tileBlob && url) {
            const {tileKey, size} = await this.storeTileRecord(
              url,
              tileBlob,
              tileSet.setName
            );
            if (tileKey) {
              tileSet.tileKeys.push(tileKey);
              tileSet.size += size;
              await this.tileStore.tileSetDB.put(tileSet);

              dispatchEvent(
                new CustomEvent('offline-map-download', {
                  detail: tileSet,
                })
              );
            }
          }
        })
      );
    }
  }

  async getTileSets() {
    if (this.tileStore.tileSetDB) {
      const tileSets = await this.tileStore.tileSetDB.getAll();
      return tileSets?.toSorted(
        (a, b) => b.created.getTime() - a.created.getTime()
      );
    } else {
      return [];
    }
  }

  async removeTileSet(setName: string) {
    const tileSet = await this.tileStore.tileSetDB.get([setName]);
    if (!tileSet) {
      throw new Error(`Offline map '${setName}' does not exist`);
    }
    // delete the tile set
    await this.tileStore.tileSetDB.delete([setName]);
    // delete the tiles if they are not part of another set
    for (const tileKey of tileSet.tileKeys) {
      const tileRecord = await this.tileStore.tileDB.get(tileKey);
      if (tileRecord) {
        const tileSetNames = tileRecord.sets;
        if (tileSetNames.length === 1) {
          await this.tileStore.tileDB.delete(tileKey);
        } else {
          // remove the tile set name from the tile record
          tileSetNames.splice(tileSetNames.indexOf(setName), 1);
          await this.tileStore.tileDB.put(tileRecord);
        }
      }
    }
  }

  /**
   * mapCacheIncludes - check whether our cache has maps to show a set of features
   *
   * @param features An array of features
   * @returns True if all features are contained within at least one tileSet extent
   */
  async mapCacheIncludes(features: Feature<Geometry>[]): Promise<boolean> {
    // If no features provided, return true (nothing to check)
    if (features.length === 0) {
      return true;
    }

    // Get all available tile sets once
    const tileSets = await this.tileStore.tileSetDB.getAll();
    if (!tileSets || tileSets.length === 0) {
      // No tile sets available, so features can't be included
      return false;
    }

    // Check each feature
    for (const feature of features) {
      const featureExtent = feature.getGeometry()?.getExtent();

      // If we can't determine the extent, skip this feature
      if (!featureExtent) {
        continue;
      }

      // Check if this feature is contained in any tile set
      let featureFound = false;
      for (const tileSet of tileSets) {
        if (containsExtent(tileSet.extent, featureExtent)) {
          featureFound = true;
          break; // No need to check other tile sets once we find one
        }
      }

      // If this feature isn't in any tile set, return false immediately
      if (!featureFound) {
        return false;
      }
    }

    // If we got here, all features were found in at least one tile set
    return true;
  }
}

export class ImageTileStore extends TileStoreBase {
  declare source: ImageTileSource;
  declare tileLayer: TileLayer;

  constructor() {
    super();
    this.source = new ImageTileSource({
      attributions: ATTRIBUTION,
      loader: this.tileLoader.bind(this),
    });
    this.tileLayer = new TileLayer({source: this.source});
  }

  getTileURLTemplate(): string | undefined {
    return TILE_URL_MAP[MAP_SOURCE]['image'];
  }

  getTileGrid() {
    return this.source.getTileGrid();
  }

  getTileLayer() {
    return this.tileLayer;
  }

  getAttribution() {
    return '&copy; OSM contributors';
  }

  async getTileAsDataURL(
    z: number,
    x: number,
    y: number
  ): Promise<string | null> {
    const image = await this.getTileBlob(this.getURLForTile({z, x, y}));
    return new Promise((resolve, reject) => {
      if (!image) {
        resolve(null);
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsDataURL(image);
      }
    });
  }

  /**
   * @param {number} z The tile z coordinate.
   * @param {number} x The tile x coordinate.
   * @param {number} y The tile y coordinate.
   * @param {LoaderOptions} options The loader options.
   * @return {Promise<HTMLImageElement>} Resolves with a loaded image.
   */
  async tileLoader(
    z: number,
    x: number,
    y: number,
    options: LoaderOptions
  ): Promise<HTMLImageElement> {
    const image = new Image();
    image.crossOrigin = options.crossOrigin ?? null;
    image.src = (await this.getTileAsDataURL(z, x, y)) || '';
    return image;
  }
}

// A vector tile source

export class VectorTileStore extends TileStoreBase {
  declare source: VectorTileSource;
  declare tileLayer: VectorTileLayer;

  constructor() {
    super();
    this.source = new VectorTileSource({
      attributions: ATTRIBUTION,
      url: this.getTileURLTemplate(),
      format: new MVT(),
      maxZoom: 14,
      tileLoadFunction: this.tileLoader.bind(this),
    });

    this.tileLayer = new VectorTileLayer({
      source: this.source,
      background: 'hsl(40, 26%, 93%)',
    });
    applyStyle(this.tileLayer, getMapStylesheet(MAP_STYLE), {
      transformRequest: this.transformRequest.bind(this),
    });
  }

  async transformRequest(url: string) {
    const fullURL = url.replace('{key}', MAP_SOURCE_KEY);
    const blob = await this.getTileBlob(fullURL);
    if (blob) {
      this.storeTileRecord(fullURL, blob, 'cache');
      const response = new Response(blob);
      // need to very explicity set the url which is supposed to be read only
      Object.defineProperty(response, 'url', {value: fullURL});
      return response;
    } else {
      return fullURL;
    }
  }

  /**
   * Get the URL template we should use for tiles
   * @returns the configured tile URL template
   */
  getTileURLTemplate(): string | undefined {
    return TILE_URL_MAP[MAP_SOURCE]['vector'];
  }

  getTileGrid() {
    return this.source.getTileGrid();
  }

  getTileLayer() {
    return this.tileLayer;
  }

  getAttribution() {
    return this.source.getAttributions();
  }

  /**
   * @param {tile} a VectorTile
   * @param {url} the URL of the target tile
   * @return {}
   */
  async tileLoader(tile: Tile) {
    // a little dance for Typescript...
    const vTile = tile as VectorTile<FeatureLike>;
    vTile.setLoader(async (extent, resolution, projection) => {
      const tileCoords = tile.getTileCoord();
      const tileUrl = this.getURLForTile({
        z: tileCoords[0],
        x: tileCoords[1],
        y: tileCoords[2],
      });
      this.getTileBlob(tileUrl).then(blob => {
        if (blob) {
          blob.arrayBuffer().then(data => {
            const format = vTile.getFormat(); // ol/format/MVT configured as source format
            const features = format.readFeatures(data, {
              extent: extent,
              featureProjection: projection,
            });
            vTile.setFeatures(features);
          });
        }
      });
    });
  }
}
