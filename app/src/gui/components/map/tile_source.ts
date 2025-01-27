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

import {Extent} from 'ol/extent';
import MVT from 'ol/format/MVT';
import TileLayer from 'ol/layer/Tile';
import VectorTileLayer from 'ol/layer/VectorTile';
import {LoaderOptions} from 'ol/source/DataTile';
import ImageTileSource from 'ol/source/ImageTile';
import OSM, {ATTRIBUTION} from 'ol/source/OSM';
import VectorTileSource from 'ol/source/VectorTile';
import {MAP_SOURCE, MAP_SOURCE_KEY} from '../../../buildconfig';

const TILE_URL_MAP: {[key: string]: string} = {
  'lima-labs': 'https://cdn.lima-labs.com/{z}/{x}/{y}.png?api={key}',
  osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  maptiler: 'https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key={key}',
};

// Type returned by reportDBSize
export interface TileDBReport {
  count: number;
  size: number;
  average: number;
}
class TileStoreBase {
  static DB_NAME = 'tiles_db';
  static STORE_NAME = 'tiles';
  static db: IDBDatabase;

  constructor() {
    if (!TileStoreBase.db) {
      this.initDB();
    }
    console.log('initialized base tile source');
    this.reportDBSize();
  }

  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(TileStoreBase.DB_NAME, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        TileStoreBase.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(TileStoreBase.STORE_NAME)) {
          db.createObjectStore(TileStoreBase.STORE_NAME);
        }
      };
    });
  }

  // get a tile grid, may be overridden by subclasses
  getTileGrid() {
    return new OSM().getTileGrid();
  }

  async clearCache() {
    console.log('clearing tile cache');
    if (TileStoreBase.db) {
      return new Promise<void>((resolve, reject) => {
        const db = TileStoreBase.db;
        const transaction = db.transaction(
          TileStoreBase.STORE_NAME,
          'readwrite'
        );
        const store = transaction.objectStore(TileStoreBase.STORE_NAME);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        store.clear();
      });
    }
  }

  async reportDBSize() {
    return new Promise<TileDBReport>((resolve, reject) => {
      if (!TileStoreBase.db) {
        return;
      }
      const transaction = TileStoreBase.db.transaction(
        TileStoreBase.STORE_NAME,
        'readonly'
      );
      const store = transaction.objectStore(TileStoreBase.STORE_NAME);
      const request = store.getAll();
      let count = 0;

      request.onsuccess = () => {
        const tiles = request.result;
        count = tiles.length;
        // const totalSize = tiles.reduce((acc, tile) => acc + tile.data.size, 0);
        const sizeMap = tiles.reduce(
          (sMap, tile) =>
            sMap.set(tile.set, (sMap.get(tile.set) | 0) + tile.data.size),
          new Map<string, number>()
        );
        console.log('size map', sizeMap);

        sizeMap.set(
          'total',
          Array.from(sizeMap.values()).reduce(
            (acc: unknown, size: unknown) => (acc as number) + (size as number),
            0
          ) as number
        );

        const average_size = sizeMap.get('total') / count;

        resolve({count: tiles.length, size: sizeMap, average: average_size});
      };
      request.onerror = () => reject(request.error);
    });
  }

  async store(x: number, y: number, z: number, data: Blob, set = 'default') {
    return new Promise<void>((resolve, reject) => {
      const transaction = TileStoreBase.db.transaction(
        TileStoreBase.STORE_NAME,
        'readwrite'
      );
      const store = transaction.objectStore(TileStoreBase.STORE_NAME);
      const request = store.put({set: set, data: data}, `${z}_${x}_${y}`);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async get(x: number, y: number, z: number): Promise<Blob | null> {
    return new Promise((resolve, reject) => {
      const transaction = TileStoreBase.db.transaction(
        TileStoreBase.STORE_NAME,
        'readonly'
      );
      const store = transaction.objectStore(TileStoreBase.STORE_NAME);
      const request = store.get(`${z}_${x}_${y}`);

      request.onsuccess = () => {
        // request.result ? console.log('hit') : console.log('miss');
        resolve(request.result ? request.result.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getTile(
    x: number,
    y: number,
    z: number,
    setName = 'default',
    cache = false
  ): Promise<string | null> {
    let image = await this.get(x, y, z);
    if (!image && navigator.onLine) {
      // console.log('fetching tile', z, x, y);
      const url = TILE_URL_MAP[MAP_SOURCE].replace('{z}', z.toString())
        .replace('{x}', x.toString())
        .replace('{y}', y.toString())
        .replace('{key}', MAP_SOURCE_KEY);
      const response = await fetch(url);
      image = await response.blob();
      // cache the image if we are told to
      if (cache) await this.store(x, y, z, image, setName);
    } else if (!image) {
      return null;
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(image);
    });
  }

  /* estimateSizeForRegion
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

    const report = await this.reportDBSize();
    const average_size = report.average || 20;

    const tileSet = new Set<string>();
    for (let zoom = minZoom; zoom <= maxZoom; zoom += 2) {
      tileGrid?.forEachTileCoord(
        extent,
        Math.ceil(zoom),
        ([z, x, y]: number[]) => {
          tileSet.add(`${z}|${x}|${y}`);
        }
      );
    }
    const counter = tileSet.size;
    const estimatedSize = Math.round((counter * average_size) / 1024);
    console.log(
      'estimated size',
      Math.round(estimatedSize),
      'MB, ',
      counter,
      'tiles'
    );
    return estimatedSize;
  }

  /**
   * getTilesForRegion - cache tiles for a given region at different zoom levels
   *
   * @param extent The extent of the region to get tiles for
   * @param minZoom Minimum zoom level to download
   * @param maxZoom Maximum zoom level to download
   */
  async getTilesForRegion(
    extent: Extent,
    minZoom: number,
    maxZoom: number,
    setName = 'default'
  ) {
    console.log('getTilesForRegion', setName, extent, minZoom, maxZoom);
    const tileGrid = this.getTileGrid();
    const tileCoords: number[][] = [];
    for (let zoom = minZoom; zoom <= maxZoom; zoom += 2) {
      tileGrid?.forEachTileCoord(extent, Math.ceil(zoom), tileCoord => {
        tileCoords.push(tileCoord);
      });
    }
    console.log('found', tileCoords.length, 'tiles');

    for (const tileCoord of tileCoords) {
      const [z, x, y] = tileCoord;
      await this.getTile(x, y, z, setName, true);
    }
    console.log('done');
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
    console.log('initialized image tile source');
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
    image.src = (await this.getTile(x, y, z)) || '';
    return image;
  }
}

// A vector tile source, will download and store vector tiles
// which should be smaller.
// TODO: Need to apply a style to the tiles to get a useful map, looked at
// ol-mapbox-style which might work but it needs a licence key. Need to
// find an open alternative.
// Also works with tiles served from local Planetiler instance
// <https://github.com/onthegomap/planetiler> but again no style.
// TODO: work out how to implement the download/cache option for these
// tiles.  `tileLoaderFunction` should be the way.

export class VectorTileStore extends TileStoreBase {
  declare source: VectorTileSource;
  declare tileLayer: VectorTileLayer;

  constructor() {
    super();
    this.source = new VectorTileSource({
      attributions: ATTRIBUTION,
      //      url: 'https://api.maptiler.com/tiles/v3-openmaptiles/{z}/{x}/{y}.pbf?key=XS7BaYII4la5ZbVgh8i2',
      url: 'http://localhost:8080/data/v3/{z}/{x}/{y}.pbf',
      format: new MVT(),
      //tileLoadFunction: this.tileLoader.bind(this),
    });
    this.tileLayer = new VectorTileLayer({
      source: this.source,
    });
    console.log('initialized vector tile source');
  }

  getTileLayer() {
    return this.tileLayer;
  }

  getAttribution() {
    return this.source.getAttributions();
  }

  /**
   */
  // async tileLoader(tile: Tile, url: string): Promise<Tile> {
  //   this.getTile(tile.getZ(), tile.getX(), tile.getY());
  // }
}
