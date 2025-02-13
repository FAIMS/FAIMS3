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
import {TileCoord} from 'ol/tilecoord';

const TILE_URL_MAP: {[key: string]: string} = {
  'lima-labs': 'https://cdn.lima-labs.com/{z}/{x}/{y}.png?api={key}',
  osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  maptiler:
    //'https://api.maptiler.com/maps/openstreetmap/{z}/{x}/{y}.jpg?key={key}',
    'https://api.maptiler.com/maps/outdoor-v2/{z}/{x}/{y}.png?key={key}',
  //'https://api.maptiler.com/maps/streets/{z}/{x}/{y}.jpg?key={key}',
};

interface StoredTile {
  x: number;
  y: number;
  z: number;
  data: Blob;
  sets: string[];
}

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

type KeyType = string | string[] | null | undefined;
class IDB<Type> {
  keyPath: KeyType;
  db: any;
  dbName: string;

  constructor(db: any, dbName: string, keyPath: KeyType) {
    this.keyPath = keyPath;
    this.db = db;
    this.dbName = dbName;
  }

  // Create the object store for this database, called in
  // onupgradeneeded for the database
  createObjectStore() {
    console.log('createObjectStore', this.dbName);
    if (!this.db.objectStoreNames.contains(this.dbName)) {
      this.db.createObjectStore(this.dbName, {
        keyPath: this.keyPath,
      });
    }
  }

  async get(query: IDBKeyRange | IDBValidKey): Promise<Type | undefined> {
    return new Promise<Type | undefined>((resolve, reject) => {
      if (!this.db) {
        return;
      }
      const transaction = this.db.transaction(this.dbName, 'readonly');
      const store = transaction.objectStore(this.dbName);
      const request = store.get(query);
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(): Promise<Type[] | undefined> {
    return new Promise<Type[] | undefined>((resolve, reject) => {
      if (!this.db) {
        return;
      }
      console.log('getAll', this.dbName);
      const transaction = this.db.transaction(this.dbName, 'readonly');
      const store = transaction.objectStore(this.dbName);
      const request = store.getAll();
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async put(object: Type) {
    return new Promise<IDBValidKey | undefined>((resolve, reject) => {
      if (!this.db) {
        return;
      }
      const transaction = this.db.transaction(this.dbName, 'readwrite');
      const store = transaction.objectStore(this.dbName);
      const request = store.put(object);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key: IDBValidKey) {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        return;
      }
      const transaction = this.db.transaction(this.dbName, 'readwrite');
      const store = transaction.objectStore(this.dbName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear() {
    if (this.db) {
      return new Promise<void>((resolve, reject) => {
        const transaction = this.db.transaction(this.dbName, 'readwrite');
        const store = transaction.objectStore(this.dbName);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        store.clear();
      });
    }
  }
}

class TileStoreBase {
  // The database is a static member of this class, there is only
  // one connection to the DB in the app
  static DB_NAME = 'tiles_db';
  static db: IDBDatabase;
  // references to the individual object stores within the database
  tileDB!: IDB<StoredTile>;
  tileSetDB!: IDB<StoredTileSet>;

  constructor() {
    this.initDB();
  }

  // initDB is called from the constructor but clients may want
  // to call it directly and wait for it to resolve if they
  // need to ensure that the databases are ready
  initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      // incrementing the version number will allow update to the schema
      const DB_VERSION = 1;
      const request = indexedDB.open(TileStoreBase.DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log('running onsuccess');
        TileStoreBase.db = request.result;
        if (!this.tileDB)
          this.tileDB = new IDB<StoredTile>(TileStoreBase.db, 'tiles', [
            'z',
            'x',
            'y',
          ]);
        if (!this.tileSetDB)
          this.tileSetDB = new IDB<StoredTileSet>(
            TileStoreBase.db,
            'tileSets',
            ['setName']
          );
        console.log('initialized base tile source');
        resolve();
      };
      request.onupgradeneeded = (event: any) => {
        console.log('onupgradeneeded', event);
        if (event.target) {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('tiles')) {
            db.createObjectStore('tiles', {
              keyPath: ['z', 'x', 'y'],
            });
          }
          if (!db.objectStoreNames.contains('tileSets')) {
            db.createObjectStore('tileSets', {
              keyPath: ['setName'],
            });
          }
        }
      };
    });
  }

  /**
   * Store a tile in the database
   * @returns the key of the tile in the database
   */
  async storeTileRecord(
    z: number,
    x: number,
    y: number,
    data: Blob,
    set: string
  ) {
    const tile = {z, x, y, data, sets: [set]};
    const existingTile = await this.tileDB.get([z, x, y]);
    if (existingTile) {
      tile.sets = [...existingTile.sets, set];
    }
    const tileKey = await this.tileDB.put(tile);
    const size = tile.data.size;
    return {tileKey, size};
  }

  async getTileBlob(
    z: number,
    x: number,
    y: number
  ): Promise<Blob | undefined> {
    const image = await this.tileDB.get([z, x, y]);
    if (image) console.log('got tile from cache', z, x, y);
    if (image) return image.data;
    else if (navigator.onLine) {
      console.log('fetching tile', z, x, y);
      const url = TILE_URL_MAP[MAP_SOURCE].replace('{z}', z.toString())
        .replace('{x}', x.toString())
        .replace('{y}', y.toString())
        .replace('{key}', MAP_SOURCE_KEY);
      const response = await fetch(url);
      return await response.blob();
    } else return undefined;
  }

  async getTileAsDataURL(
    z: number,
    x: number,
    y: number
  ): Promise<string | null> {
    const image = await this.getTileBlob(z, x, y);
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

  // get the tile grid, will be overridden by subclasses but 
  // here git the generic OSM grid
  getTileGrid() {
    const osm = new OSM();
    return osm.getTileGrid();
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
    const average_size = 10; // kb

    const tileSet = new Set<string>();
    for (let zoom = minZoom; zoom <= maxZoom; zoom += 1) {
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
    const existingTileSet = await this.tileSetDB.get([setName]);
    if (existingTileSet) {
      throw new Error(
        `Offline map '${setName}' already exists, please choose a different name`
      );
    }
    // create a record for this region
    const tileSet: StoredTileSet = {
      setName,
      extent,
      minZoom,
      maxZoom,
      size: 0,
      expectedTileCount: 0,
      created: new Date(),
      tileKeys: [],
    };
    this.tileSetDB.put(tileSet);

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
    const tileSet = await this.tileSetDB.get([setName]);
    if (!tileSet) {
      throw new Error(`No offline map '${setName}' found`);
    }
    console.log('downloading tiles for ', tileSet);

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
    this.tileSetDB.put(tileSet);

    for (const tileCoord of tileCoords) {
      const [z, x, y] = tileCoord;
      const tileBlob = await this.getTileBlob(z, x, y);
      if (tileBlob) {
        const {tileKey, size} = await this.storeTileRecord(
          z,
          x,
          y,
          tileBlob,
          tileSet.setName
        );
        if (tileKey) {
          tileSet.tileKeys.push(tileKey);
          tileSet.size += size;
          // update DB after each download to enable live progress
          this.tileSetDB.put(tileSet);
          // signal to anyone listening that we have made progress
          const event = new CustomEvent('offline-map-download', {
            detail: tileSet,
          });
          dispatchEvent(event);
        }
      }
    }
  }

  async getTileSets() {
    if (this.tileSetDB) {
      const tileSets = await this.tileSetDB.getAll();
      return tileSets?.toSorted(
        (a, b) => b.created.getTime() - a.created.getTime()
      );
    } else {
      return [];
    }
  }

  async removeTileSet(setName: string) {
    const tileSet = await this.tileSetDB.get([setName]);
    if (!tileSet) {
      throw new Error(`Offline map '${setName}' does not exist`);
    }
    // delete the tile set
    await this.tileSetDB.delete([setName]);
    // delete the tiles if they are not part of another set
    for (const tileKey of tileSet.tileKeys) {
      const tileRecord = await this.tileDB.get(tileKey);
      if (tileRecord) {
        const tileSetNames = tileRecord.sets;
        if (tileSetNames.length === 1) {
          await this.tileDB.delete(tileKey);
        } else {
          // remove the tile set name from the tile record
          tileSetNames.splice(tileSetNames.indexOf(setName), 1);
          await this.tileDB.put(tileRecord);
        }
      }
    }
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
    image.src = (await this.getTileAsDataURL(z, x, y)) || '';
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
      url: 'https://api.maptiler.com/tiles/v3-openmaptiles/{z}/{x}/{y}.pbf?key={key}',
      format: new MVT(),
      //tileLoadFunction: this.tileLoader.bind(this),
    });
    this.tileLayer = new VectorTileLayer({
      source: this.source,
    });
    console.log('initialized vector tile source');
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
   */
  // async tileLoader(tile: Tile, url: string): Promise<Tile> {
  //   this.getTile(tile.getZ(), tile.getX(), tile.getY());
  // }
}
