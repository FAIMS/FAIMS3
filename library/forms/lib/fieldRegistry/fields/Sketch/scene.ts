/*
 * Copyright 2026 FAIMS Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {z} from 'zod';
import {getStroke} from 'perfect-freehand';

/** Long edge of a new canvas in logical pixels. Raster PNG matches this. */
export const SKETCH_LONG_EDGE = 1600;
/** Fallback landscape size when the viewport is not available yet. */
export const SKETCH_LOGICAL_WIDTH = 1600;
export const SKETCH_LOGICAL_HEIGHT = 1200;

export const SKETCH_SCENE_VERSION = 1;

export const SKETCH_COLORS = [
  '#111111',
  '#e53935',
  '#1e88e5',
  '#43a047',
  '#fb8c00',
  '#fdd835',
  '#ffffff',
] as const;

export const SKETCH_STROKE_WIDTHS = [3, 8, 16] as const;

const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
  p: z.number().optional(),
});

const strokeObjectSchema = z.object({
  id: z.string(),
  type: z.literal('stroke'),
  points: z.array(pointSchema).min(1),
  color: z.string(),
  width: z.number().positive(),
});

const lineObjectSchema = z.object({
  id: z.string(),
  type: z.literal('line'),
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  color: z.string(),
  width: z.number().positive(),
});

const rectObjectSchema = z.object({
  id: z.string(),
  type: z.literal('rect'),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  color: z.string(),
  strokeWidth: z.number().positive(),
});

const ellipseObjectSchema = z.object({
  id: z.string(),
  type: z.literal('ellipse'),
  x: z.number(),
  y: z.number(),
  radiusX: z.number(),
  radiusY: z.number(),
  color: z.string(),
  strokeWidth: z.number().positive(),
});

export const sketchObjectSchema = z.discriminatedUnion('type', [
  strokeObjectSchema,
  lineObjectSchema,
  rectObjectSchema,
  ellipseObjectSchema,
]);

export const sketchSceneSchema = z.object({
  version: z.literal(SKETCH_SCENE_VERSION),
  width: z.number().positive(),
  height: z.number().positive(),
  background: z.string(),
  objects: z.array(sketchObjectSchema),
  /** Attachment id of the last rasterized PNG, when known. */
  attachmentId: z.string().optional(),
});

export type SketchPoint = z.infer<typeof pointSchema>;
export type SketchObject = z.infer<typeof sketchObjectSchema>;
export type SketchScene = z.infer<typeof sketchSceneSchema>;

export type SketchTool = 'pen' | 'eraser' | 'line' | 'rect' | 'ellipse';

export function createEmptyScene(size?: {
  width: number;
  height: number;
}): SketchScene {
  return {
    version: SKETCH_SCENE_VERSION,
    width: size?.width ?? SKETCH_LOGICAL_WIDTH,
    height: size?.height ?? SKETCH_LOGICAL_HEIGHT,
    background: '#ffffff',
    objects: [],
  };
}

/**
 * Logical canvas size that matches `availWidth` × `availHeight`.
 * The longer side is {@link SKETCH_LONG_EDGE} so stroke weight stays stable
 * across phones and desktops; the shorter side follows the viewport ratio.
 */
export function sceneSizeForViewport(
  availWidth: number,
  availHeight: number
): {width: number; height: number} {
  if (availWidth <= 0 || availHeight <= 0) {
    return {width: SKETCH_LOGICAL_WIDTH, height: SKETCH_LOGICAL_HEIGHT};
  }
  const ratio = availWidth / availHeight;
  if (ratio >= 1) {
    return {
      width: SKETCH_LONG_EDGE,
      height: Math.max(1, Math.round(SKETCH_LONG_EDGE / ratio)),
    };
  }
  return {
    width: Math.max(1, Math.round(SKETCH_LONG_EDGE * ratio)),
    height: SKETCH_LONG_EDGE,
  };
}

/**
 * CSS pixels of the visible window. Uses `visualViewport` so Chrome device
 * mode and iOS URL-bar resizing report the emulated/visible size, not the
 * layout viewport.
 */
export function readSketchViewportCssSize(): {width: number; height: number} {
  if (typeof window === 'undefined') {
    return {width: SKETCH_LOGICAL_WIDTH, height: SKETCH_LOGICAL_HEIGHT};
  }
  const innerW = window.innerWidth;
  const innerH = window.innerHeight;
  const vv = window.visualViewport;
  // Take the smaller box. Chrome device mode can leave visualViewport at
  // the previous desktop size after a delete → resize → reopen, which
  // locked new sketches to landscape until a later remeasure.
  const width = Math.round(Math.min(vv?.width ?? innerW, innerW));
  const height = Math.round(Math.min(vv?.height ?? innerH, innerH));
  return {width, height};
}

/**
 * Keep stored width/height only when there are strokes. An empty scene
 * (including after delete, or leftover attachmentId with no objects) is
 * treated as new and must pick up the current viewport.
 */
export function shouldPreserveSceneSize(
  scene: SketchScene | null | undefined
): boolean {
  return !isSceneEmpty(scene);
}

/** Empty scene sized for the current window. Drops any leftover attachmentId. */
export function emptySceneForViewport(chromeHeight = 0): SketchScene {
  const viewport = readSketchViewportCssSize();
  return createEmptyScene(
    sceneSizeForViewport(
      viewport.width,
      Math.max(1, viewport.height - chromeHeight)
    )
  );
}

export function parseSketchScene(value: unknown): SketchScene {
  const parsed = sketchSceneSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  return createEmptyScene();
}

export function isSceneEmpty(scene: SketchScene | null | undefined): boolean {
  return !scene || scene.objects.length === 0;
}

export function sceneEquals(a: SketchScene, b: SketchScene): boolean {
  return (
    JSON.stringify(normalizeSceneForCompare(a)) ===
    JSON.stringify(normalizeSceneForCompare(b))
  );
}

/** Ignore attachmentId when deciding whether the drawing itself changed. */
function normalizeSceneForCompare(
  scene: SketchScene
): Omit<SketchScene, 'attachmentId'> {
  const {attachmentId: _ignored, ...rest} = scene;
  return rest;
}

export function createObjectId(): string {
  return `sk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Outline a freehand stroke for Konva / SVG using perfect-freehand.
 */
export function strokeToSvgPath(points: SketchPoint[], width: number): string {
  if (points.length === 0) {
    return '';
  }
  const input = points.map(pt =>
    pt.p === undefined ? [pt.x, pt.y] : [pt.x, pt.y, pt.p]
  );
  const outline = getStroke(input, {
    size: width,
    thinning: 0.55,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: points.every(pt => pt.p === undefined),
  });
  return getSvgPathFromStroke(outline);
}

/** Standard perfect-freehand → SVG path (closed). */
export function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) {
    return '';
  }
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q'] as Array<string | number>
  );
  d.push('Z');
  return d.join(' ');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/** SVG snapshot of a scene — used for thumbnails when the PNG is not downloaded. */
export function sceneToSvgString(scene: SketchScene): string {
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}">`,
    `<rect width="100%" height="100%" fill="${escapeXml(scene.background)}"/>`,
  ];
  for (const obj of scene.objects) {
    if (obj.type === 'stroke') {
      const d = strokeToSvgPath(obj.points, obj.width);
      if (d) {
        parts.push(
          `<path d="${d}" fill="${escapeXml(obj.color)}" stroke="none"/>`
        );
      }
    } else if (obj.type === 'line') {
      parts.push(
        `<line x1="${obj.x1}" y1="${obj.y1}" x2="${obj.x2}" y2="${obj.y2}" stroke="${escapeXml(obj.color)}" stroke-width="${obj.width}" stroke-linecap="round"/>`
      );
    } else if (obj.type === 'rect') {
      const x = Math.min(obj.x, obj.x + obj.width);
      const y = Math.min(obj.y, obj.y + obj.height);
      parts.push(
        `<rect x="${x}" y="${y}" width="${Math.abs(obj.width)}" height="${Math.abs(obj.height)}" fill="none" stroke="${escapeXml(obj.color)}" stroke-width="${obj.strokeWidth}"/>`
      );
    } else {
      parts.push(
        `<ellipse cx="${obj.x}" cy="${obj.y}" rx="${Math.abs(obj.radiusX)}" ry="${Math.abs(obj.radiusY)}" fill="none" stroke="${escapeXml(obj.color)}" stroke-width="${obj.strokeWidth}"/>`
      );
    }
  }
  parts.push('</svg>');
  return parts.join('');
}

export function sceneToSvgBlobUrl(scene: SketchScene): string {
  const blob = new Blob([sceneToSvgString(scene)], {type: 'image/svg+xml'});
  return URL.createObjectURL(blob);
}

/** Value schema for the field `data` slot (scene JSON). */
export function sketchFieldDataSchema(required: boolean) {
  const base = sketchSceneSchema;
  if (!required) {
    return z.union([base, z.null(), z.undefined()]).optional();
  }
  return base.refine(scene => !isSceneEmpty(scene), {
    message: 'A sketch is required',
  });
}
