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

import OSM, {ATTRIBUTION} from 'ol/source/OSM';
import {LoaderOptions} from 'ol/source/DataTile';
import ImageTileSource from 'ol/source/ImageTile';
import PouchDB from 'pouchdb-browser';
import {Extent} from 'ol/extent';

interface Tile {
  _id: string;
  set: string;
  data: Blob;
}

export class TileStore {
  static DB_NAME = 'tiles_db';
  static STORE_NAME = 'tiles';
  static db: IDBDatabase;
  source!: ImageTileSource;

  constructor() {
    if (!TileStore.db) {
      this.initDB();
    }
    this.clearCache();
    this.source = new ImageTileSource({
      attributions: ATTRIBUTION,
      loader: this.tileLoader.bind(this),
    });
    this.report_size();
  }

  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(TileStore.DB_NAME, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        TileStore.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(TileStore.STORE_NAME)) {
          db.createObjectStore(TileStore.STORE_NAME);
        }
      };
    });
  }

  async clearCache() {
    console.log('clearing tile cache');
    if (TileStore.db) {
      const db = TileStore.db;
      const transaction = db.transaction(TileStore.STORE_NAME, 'readwrite');
      const store = transaction.objectStore(TileStore.STORE_NAME);
      store.clear();
    }
  }

  async report_size() {
    return new Promise<void>((resolve, reject) => {
      if (!TileStore.db) {
        return;
      }
      const transaction = TileStore.db.transaction(
        TileStore.STORE_NAME,
        'readonly'
      );
      const store = transaction.objectStore(TileStore.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const tiles = request.result;
        const totalSize = tiles.reduce((acc, tile) => acc + tile.data.size, 0);
        const size = Math.round((100 * totalSize) / 1024 / 1024) / 100;
        const average_size = Math.round(totalSize / tiles.length / 1024);

        console.log(
          `tile store has ${tiles.length} tiles using ${size}M average ${average_size}Kb`
        );
        resolve();
      };
      request.onerror = () => reject(request.error);
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
    image.src = (await this.getImageTile(x, y, z)) || '';
    return image;
  }

  async store(x: number, y: number, z: number, data: Blob, set = 'default') {
    return new Promise<void>((resolve, reject) => {
      const transaction = TileStore.db.transaction(
        TileStore.STORE_NAME,
        'readwrite'
      );
      const store = transaction.objectStore(TileStore.STORE_NAME);
      const request = store.put({set: set, data: data}, `${z}_${x}_${y}`);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async get(x: number, y: number, z: number): Promise<Blob | null> {
    return new Promise((resolve, reject) => {
      const transaction = TileStore.db.transaction(
        TileStore.STORE_NAME,
        'readonly'
      );
      const store = transaction.objectStore(TileStore.STORE_NAME);
      const request = store.get(`${z}_${x}_${y}`);

      request.onsuccess = () => {
        // request.result ? console.log('hit') : console.log('miss');
        resolve(request.result ? request.result.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getImageTile(
    x: number,
    y: number,
    z: number,
    setName = 'default'
  ): Promise<string | null> {
    let image = await this.get(x, y, z);
    if (!image && navigator.onLine) {
      console.log('fetching tile', z, x, y);
      const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
      const response = await fetch(url);
      image = await response.blob();
      this.store(x, y, z, image, setName);
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
    const OSMSource = new OSM();
    const tileGrid = OSMSource.getTileGrid();

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
    const estimatedSize = Math.round((counter * 12) / 1024);
    console.log('estimated size', Math.round(estimatedSize), 'MB, ', counter, 'tiles');
    return estimatedSize;
  }

  /**
   * getTilesForRegion - cache tiles for a given region at different zoom levels
   *
   * @param extent The extent of the region to get tiles for
   * @param minZoom Minimum zoom level to download
   * @param maxZoom Maximum zoom level to download
   */
  async getTilesForRegion(extent: Extent, minZoom: number, maxZoom: number) {
    console.log('getTilesForRegion', extent, minZoom, maxZoom);
    const OSMSource = new OSM();
    const tileGrid = OSMSource.getTileGrid();
    const tileSet = new Set<string>();
    for (let zoom = minZoom; zoom <= maxZoom; zoom += 2) {
      tileGrid?.forEachTileCoord(extent, Math.ceil(zoom), async tileCoord => {
        const [z, x, y] = tileCoord;
        const tc = `${z}|${x}|${y}`;
        if (!tileSet.has(tc)) {
          tileSet.add(tc);
          await this.getImageTile(x, y, z);
          console.log('fetched', x, y, z);
        }
      });
    }
  }
}
