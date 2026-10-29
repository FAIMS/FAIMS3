// SPDX-License-Identifier: Apache-2.0
/**
 * Flatten FeatureCollection-in-FeatureCollection GeoJSON to leaf Features.
 *
 * RFC 7946 forbids a FeatureCollection as a `features[]` item. GDAL's
 * GeoJSON driver only walks the root array, so those wrappers become an
 * empty layer and tippecanoe exits 110 ("Did not read any valid
 * geometries"). This pass streams the file and writes a flat
 * FeatureCollection of Feature / geometry objects. A `features` array
 * is walked as soon as it is seen, even if `type` comes later, so a
 * nested file is not scanned twice. A root-level legacy `crs` member is
 * copied onto the output so ogrinfo / ogr2ogr still see a non-WGS84
 * CRS after flatten. Attributes stay; ogr2ogr `-select ''` still drops
 * them.
 */

import {createWriteStream} from 'fs';
import {open, type FileHandle} from 'fs/promises';
import {finished} from 'stream/promises';

const CHUNK_SIZE = 64 * 1024;
const RS = 0x1e;
const QUOTE = 0x22;
const COMMA = 0x2c;
const COLON = 0x3a;
const L_BRACKET = 0x5b;
const R_BRACKET = 0x5d;
const L_BRACE = 0x7b;
const R_BRACE = 0x7d;
const BACKSLASH = 0x5c;

const GEOMETRY_TYPES = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection',
]);

export function isGeoJsonPath(filePath: string): boolean {
  return /\.(?:geojson|json)$/i.test(filePath);
}

/** Byte-percent while rewriting nested FeatureCollections. */
export type FlattenGeoJsonProgress = {
  percent: number;
};

/** Raw JSON of a root FeatureCollection `crs` member, if one was present. */
type RootCrsCapture = {
  raw?: string;
};

/** Write leaf Features from `inputPath` as one FeatureCollection. */
export async function flattenNestedFeatureCollections(
  inputPath: string,
  outputPath: string,
  onProgress?: (progress: FlattenGeoJsonProgress) => void | Promise<void>
): Promise<number> {
  const reader = await JsonFileReader.open(inputPath);
  const writer = createWriteStream(outputPath);
  const count = {n: 0};
  const rootCrs: RootCrsCapture = {};
  let lastPercent = -1;
  const report = async (force = false) => {
    if (!onProgress) {
      return;
    }
    const percent =
      reader.fileSize === 0
        ? 100
        : Math.min(100, (reader.pos / reader.fileSize) * 100);
    const rounded = Math.round(percent);
    if (!force && rounded === lastPercent) {
      return;
    }
    lastPercent = rounded;
    await onProgress({percent: rounded});
  };
  reader.onProgressTick = () => report();
  try {
    writer.write('{"type":"FeatureCollection","features":[');
    await reader.skipBom();
    await report();
    let captureRootCrs = true;
    while (!(await reader.eof())) {
      await reader.skipWsAndRs();
      if (await reader.eof()) {
        break;
      }
      // Only the first top-level object is the collection whose `crs`
      // GDAL would have used. Nested collections and later GeoJSONSeq
      // records must not overwrite it.
      await walkValue(
        reader,
        writer,
        count,
        report,
        captureRootCrs ? rootCrs : undefined
      );
      captureRootCrs = false;
    }
    writer.write(']');
    if (rootCrs.raw && rootCrs.raw.trim()) {
      writer.write(',"crs":');
      writer.write(rootCrs.raw);
    }
    writer.write('}');
    writer.end();
    await finished(writer);
    await report(true);
    return count.n;
  } catch (error) {
    writer.destroy();
    throw error;
  } finally {
    await reader.close();
  }
}

async function walkValue(
  reader: JsonFileReader,
  writer: NodeJS.WritableStream,
  count: {n: number},
  report: () => Promise<void>,
  rootCrs?: RootCrsCapture
): Promise<void> {
  await reader.skipWs();
  const byte = await reader.peekByte();
  if (byte === L_BRACKET) {
    await walkArray(reader, writer, count, report);
    return;
  }
  if (byte !== L_BRACE) {
    await reader.skipValue();
    return;
  }
  const start = reader.pos;
  await reader.expectByte(L_BRACE);
  await reader.skipWs();
  let type: string | undefined;
  let walkedFeatures = false;
  let hasGeometry = false;
  if ((await reader.peekByte()) !== R_BRACE) {
    while (true) {
      const key = await reader.readJsonString();
      await reader.skipWs();
      await reader.expectByte(COLON);
      await reader.skipWs();
      if (key === 'type' && (await reader.peekByte()) === QUOTE) {
        type = await reader.readJsonString();
      } else if (
        key === 'features' &&
        (await reader.peekByte()) === L_BRACKET
      ) {
        // Walk immediately even when `type` has not been seen yet. JSON
        // key order is not fixed; skipping the array and rewinding would
        // scan a nested collection twice with no progress ticks.
        if (type === undefined || type === 'FeatureCollection') {
          await walkArray(reader, writer, count, report);
          walkedFeatures = true;
        } else {
          await reader.skipValue();
        }
      } else if (key === 'geometry') {
        const geomByte = await reader.peekByte();
        hasGeometry = geomByte === L_BRACE || geomByte === L_BRACKET;
        await reader.skipValue();
      } else if (key === 'crs' && rootCrs) {
        const crsStart = reader.pos;
        await reader.skipValue();
        rootCrs.raw = await reader.readRange(crsStart, reader.pos);
      } else {
        await reader.skipValue();
      }
      await reader.skipWs();
      const next = await reader.peekByte();
      if (next === COMMA) {
        await reader.readByte();
        await reader.skipWs();
        continue;
      }
      if (next === R_BRACE) {
        await reader.readByte();
        break;
      }
      throw new Error('Invalid GeoJSON object while flattening features.');
    }
  } else {
    await reader.readByte();
  }
  const end = reader.pos;
  if (type === 'Feature' && hasGeometry && !walkedFeatures) {
    emitRawFeature(writer, count, await reader.readRange(start, end));
  } else if (type && GEOMETRY_TYPES.has(type) && !walkedFeatures) {
    const raw = await reader.readRange(start, end);
    emitLeaf(writer, count, JSON.parse(raw) as Record<string, unknown>);
  }
  await report();
}

async function walkArray(
  reader: JsonFileReader,
  writer: NodeJS.WritableStream,
  count: {n: number},
  report: () => Promise<void>
): Promise<void> {
  await reader.expectByte(L_BRACKET);
  await reader.skipWs();
  if ((await reader.peekByte()) === R_BRACKET) {
    await reader.readByte();
    return;
  }
  while (true) {
    await walkValue(reader, writer, count, report);
    await reader.skipWs();
    const byte = await reader.peekByte();
    if (byte === COMMA) {
      await reader.readByte();
      await reader.skipWs();
      continue;
    }
    if (byte === R_BRACKET) {
      await reader.readByte();
      return;
    }
    throw new Error('Invalid GeoJSON array while flattening features.');
  }
}

function emitRawFeature(
  writer: NodeJS.WritableStream,
  count: {n: number},
  raw: string
): void {
  if (count.n > 0) {
    writer.write(',');
  }
  writer.write(raw);
  count.n += 1;
}

function emitLeaf(
  writer: NodeJS.WritableStream,
  count: {n: number},
  value: Record<string, unknown>
): void {
  const type = value.type;
  let feature: Record<string, unknown> | undefined;
  if (type === 'Feature') {
    if (!value.geometry || typeof value.geometry !== 'object') {
      return;
    }
    feature = value;
  } else if (typeof type === 'string' && GEOMETRY_TYPES.has(type)) {
    feature = {type: 'Feature', geometry: value, properties: {}};
  }
  if (!feature) {
    return;
  }
  if (count.n > 0) {
    writer.write(',');
  }
  writer.write(JSON.stringify(feature));
  count.n += 1;
}

class JsonFileReader {
  private buf = new Uint8Array(0);
  private bufFileStart = 0;
  private offset = 0;
  private unreadSinceReport = 0;
  pos = 0;
  /** Called after each ~64 KiB of scanned bytes so long skips still tick. */
  onProgressTick?: () => void | Promise<void>;

  private constructor(
    private readonly handle: FileHandle,
    readonly fileSize: number
  ) {}

  static async open(filePath: string): Promise<JsonFileReader> {
    const handle = await open(filePath, 'r');
    const {size} = await handle.stat();
    return new JsonFileReader(handle, size);
  }

  async close(): Promise<void> {
    await this.handle.close();
  }

  async eof(): Promise<boolean> {
    return this.pos >= this.fileSize;
  }

  async skipBom(): Promise<void> {
    if (this.fileSize < 3) {
      return;
    }
    await this.ensure(3);
    if (
      this.buf[this.offset] === 0xef &&
      this.buf[this.offset + 1] === 0xbb &&
      this.buf[this.offset + 2] === 0xbf
    ) {
      this.advance(3);
    }
  }

  async skipWsAndRs(): Promise<void> {
    while (!(await this.eof())) {
      const byte = await this.peekByte();
      if (byte === RS || isWhitespace(byte)) {
        await this.readByte();
        continue;
      }
      return;
    }
  }

  async skipWs(): Promise<void> {
    while (!(await this.eof())) {
      const byte = await this.peekByte();
      if (!isWhitespace(byte)) {
        return;
      }
      await this.readByte();
    }
  }

  async peekByte(): Promise<number> {
    if (await this.eof()) {
      return -1;
    }
    await this.ensure(1);
    return this.buf[this.offset];
  }

  async readByte(): Promise<number> {
    const byte = await this.peekByte();
    if (byte < 0) {
      throw new Error('Unexpected end of GeoJSON.');
    }
    this.advance(1);
    return byte;
  }

  async expectByte(expected: number): Promise<void> {
    const byte = await this.readByte();
    if (byte !== expected) {
      throw new Error(
        `Invalid GeoJSON: expected ${String.fromCharCode(expected)}.`
      );
    }
  }

  async readJsonString(): Promise<string> {
    await this.expectByte(QUOTE);
    const bytes = [QUOTE];
    let escaped = false;
    while (true) {
      const byte = await this.readByte();
      bytes.push(byte);
      if (escaped) {
        escaped = false;
        continue;
      }
      if (byte === BACKSLASH) {
        escaped = true;
        continue;
      }
      if (byte === QUOTE) {
        return JSON.parse(Buffer.from(bytes).toString('utf8')) as string;
      }
    }
  }

  async skipValue(): Promise<void> {
    await this.skipWs();
    const byte = await this.peekByte();
    if (byte === QUOTE) {
      await this.readJsonString();
      return;
    }
    if (byte === L_BRACE || byte === L_BRACKET) {
      await this.skipContainer();
      return;
    }
    if (byte === 0x74 || byte === 0x66 || byte === 0x6e) {
      await this.skipLiteral();
      return;
    }
    await this.skipNumber();
  }

  async readRange(start: number, end: number): Promise<string> {
    const length = end - start;
    const buffer = new Uint8Array(length);
    const {bytesRead} = await this.handle.read(buffer, 0, length, start);
    if (bytesRead !== length) {
      throw new Error('Unexpected end of GeoJSON.');
    }
    return Buffer.from(buffer).toString('utf8');
  }

  /**
   * Walk a `{...}` / `[...]` without per-byte awaits. A 200 MB nested
   * collection used to sit silent in this loop (especially when
   * `features` appeared before `type`). Scan the current buffer, then
   * tick progress.
   */
  private async skipContainer(): Promise<void> {
    const stack = [await this.readByte()];
    let inString = false;
    let escaped = false;
    while (stack.length > 0) {
      if (this.offset >= this.buf.length) {
        await this.ensure(1);
        if (this.offset >= this.buf.length) {
          throw new Error('Unexpected end of GeoJSON.');
        }
      }
      const from = this.offset;
      while (this.offset < this.buf.length && stack.length > 0) {
        const byte = this.buf[this.offset++];
        if (inString) {
          if (escaped) {
            escaped = false;
            continue;
          }
          if (byte === BACKSLASH) {
            escaped = true;
            continue;
          }
          if (byte === QUOTE) {
            inString = false;
          }
          continue;
        }
        if (byte === QUOTE) {
          inString = true;
          continue;
        }
        if (byte === L_BRACE || byte === L_BRACKET) {
          stack.push(byte);
          continue;
        }
        const open = stack[stack.length - 1];
        if (
          (byte === R_BRACE && open === L_BRACE) ||
          (byte === R_BRACKET && open === L_BRACKET)
        ) {
          stack.pop();
        }
      }
      const consumed = this.offset - from;
      this.pos += consumed;
      this.unreadSinceReport += consumed;
      await this.maybeReportProgress();
    }
  }

  private async maybeReportProgress(): Promise<void> {
    if (this.unreadSinceReport < CHUNK_SIZE || !this.onProgressTick) {
      return;
    }
    this.unreadSinceReport = 0;
    await this.onProgressTick();
  }

  private async skipLiteral(): Promise<void> {
    const first = await this.readByte();
    const rest =
      first === 0x74
        ? 'rue'
        : first === 0x66
          ? 'alse'
          : first === 0x6e
            ? 'ull'
            : '';
    for (const char of rest) {
      await this.expectByte(char.charCodeAt(0));
    }
  }

  private async skipNumber(): Promise<void> {
    while (!(await this.eof())) {
      const byte = await this.peekByte();
      if (
        (byte >= 0x30 && byte <= 0x39) ||
        byte === 0x2b ||
        byte === 0x2d ||
        byte === 0x2e ||
        byte === 0x45 ||
        byte === 0x65
      ) {
        await this.readByte();
        continue;
      }
      return;
    }
  }

  private async ensure(needed: number): Promise<void> {
    while (
      this.offset + needed > this.buf.length &&
      this.remainingOnDisk() > 0
    ) {
      const unread = this.buf.subarray(this.offset);
      const chunk = new Uint8Array(CHUNK_SIZE);
      const {bytesRead} = await this.handle.read(
        chunk,
        0,
        CHUNK_SIZE,
        this.bufFileStart + this.buf.length
      );
      const next = new Uint8Array(unread.length + bytesRead);
      next.set(unread);
      next.set(chunk.subarray(0, bytesRead), unread.length);
      this.buf = next;
      this.bufFileStart = this.pos;
      this.offset = 0;
      if (bytesRead === 0) {
        break;
      }
    }
  }

  private remainingOnDisk(): number {
    return this.fileSize - (this.bufFileStart + this.buf.length);
  }

  private advance(bytes: number): void {
    this.offset += bytes;
    this.pos += bytes;
    this.unreadSinceReport += bytes;
  }
}

function isWhitespace(byte: number): boolean {
  return byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d;
}
