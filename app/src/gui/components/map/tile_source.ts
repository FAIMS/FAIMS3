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

import {LoaderOptions} from 'ol/source/DataTile';
import ImageTileSource from 'ol/source/ImageTile';
import PouchDB from 'pouchdb-browser';

interface Tile {
  _id: string;
  set: string;
  data: string;
}

export class TileStore {
  static db: PouchDB.Database<Tile>;
  source!: ImageTileSource;

  constructor() {
    if (!TileStore.db) {
      TileStore.db = new PouchDB<Tile>('tiles');
      console.log('created tile store db', TileStore.db);
    }
    this.source = new ImageTileSource({loader: this.tileLoader.bind(this)});
    this.report_size();
  }

  async report_size() {
    TileStore.db
      .query({
        map: (doc, emit) => {
          emit && emit(doc._id, doc.data.length);
        },
        reduce: '_sum',
      })
      .then(result => {
        console.log(
          `tile store is ${Math.round(100*result.rows[0].value / 1024 / 1024)/100}M`
        );
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
    image.src = await this.getImageTile(x, y, z);
    return image;
  }

  async store(x: number, y: number, z: number, data: string, set = 'default') {
    const tile = {
      _id: `${z}_${x}_${y}`,
      set: set,
      data: data,
    };
    try {
      await TileStore.db.put(tile);
    } catch (error) {
      console.log('error storing tile', error);
    }
  }

  async get(x: number, y: number, z: number) {
    try {
      const result = await TileStore.db.get(`${z}_${x}_${y}`);
      return result.data;
    } catch {
      return null;
    }
  }

  async getImageTile(x: number, y: number, z: number): Promise<string> {
    const cachedImage = await this.get(x, y, z);
    if (cachedImage) {
      // console.log('using cached tile', z, x, y);
      return cachedImage;
    } else {
      // console.log('fetching tile', z, x, y);
      const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          this.store(x, y, z, reader.result as string);
          resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  }
}
