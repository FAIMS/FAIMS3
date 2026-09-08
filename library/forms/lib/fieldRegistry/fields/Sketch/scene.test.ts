/*
 * Copyright 2026 FAIMS Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {describe, expect, it} from 'vitest';
import {
  createEmptyScene,
  createObjectId,
  isSceneEmpty,
  parseSketchScene,
  sceneEquals,
  sceneToSvgString,
  sketchFieldDataSchema,
  readSketchViewportCssSize,
  sceneSizeForViewport,
  shouldPreserveSceneSize,
  SKETCH_LOGICAL_HEIGHT,
  SKETCH_LOGICAL_WIDTH,
  SKETCH_LONG_EDGE,
  SketchScene,
} from './scene';

const sampleScene = (): SketchScene => ({
  ...createEmptyScene(),
  objects: [
    {
      id: 's1',
      type: 'stroke',
      points: [
        {x: 10, y: 10},
        {x: 20, y: 24},
        {x: 40, y: 18},
      ],
      color: '#111111',
      width: 8,
    },
    {
      id: 'l1',
      type: 'line',
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 50,
      color: '#e53935',
      width: 3,
    },
  ],
});

describe('sketch scene helpers', () => {
  it('creates an empty fallback landscape scene', () => {
    const scene = createEmptyScene();
    expect(scene.version).toBe(1);
    expect(scene.width).toBe(SKETCH_LOGICAL_WIDTH);
    expect(scene.height).toBe(SKETCH_LOGICAL_HEIGHT);
    expect(isSceneEmpty(scene)).toBe(true);
  });

  it('accepts an explicit size for a new empty scene', () => {
    const scene = createEmptyScene({width: 900, height: 1600});
    expect(scene.width).toBe(900);
    expect(scene.height).toBe(1600);
    expect(isSceneEmpty(scene)).toBe(true);
  });

  it('uses the smaller of visualViewport and inner window size', () => {
    const previousVv = window.visualViewport;
    const previousInnerW = window.innerWidth;
    const previousInnerH = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 844,
    });
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {width: 1280, height: 800},
    });
    expect(readSketchViewportCssSize()).toEqual({width: 390, height: 800});
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: previousVv,
    });
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: previousInnerW,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: previousInnerH,
    });
  });

  it('sizes a new canvas from the viewport, portrait and landscape', () => {
    const portrait = sceneSizeForViewport(390, 720);
    expect(portrait.height).toBe(SKETCH_LONG_EDGE);
    expect(portrait.width).toBe(Math.round(SKETCH_LONG_EDGE * (390 / 720)));

    const landscape = sceneSizeForViewport(1200, 700);
    expect(landscape.width).toBe(SKETCH_LONG_EDGE);
    expect(landscape.height).toBe(Math.round(SKETCH_LONG_EDGE / (1200 / 700)));
  });

  it('preserves size only when strokes exist, not leftover attachment ids', () => {
    expect(shouldPreserveSceneSize(createEmptyScene())).toBe(false);
    expect(shouldPreserveSceneSize(sampleScene())).toBe(true);
    expect(
      shouldPreserveSceneSize({
        ...createEmptyScene(),
        attachmentId: 'att-1',
      })
    ).toBe(false);
  });

  it('parses a valid scene and falls back for garbage', () => {
    const valid = sampleScene();
    expect(parseSketchScene(valid)).toEqual(valid);
    expect(isSceneEmpty(parseSketchScene(null))).toBe(true);
    expect(isSceneEmpty(parseSketchScene({foo: 1}))).toBe(true);
  });

  it('compares scenes ignoring attachmentId', () => {
    const a = sampleScene();
    const b = {...sampleScene(), attachmentId: 'att-1'};
    expect(sceneEquals(a, b)).toBe(true);
    expect(sceneEquals(a, {...a, objects: []})).toBe(false);
  });

  it('emits SVG with strokes and shapes', () => {
    const svg = sceneToSvgString(sampleScene());
    expect(svg).toContain('<svg');
    expect(svg).toContain('<path');
    expect(svg).toContain('<line');
    expect(svg).toContain('#e53935');
  });

  it('mints unique object ids', () => {
    expect(createObjectId()).not.toBe(createObjectId());
  });
});

describe('sketch field data schema', () => {
  it('requires a non-empty scene when the field is required', () => {
    const schema = sketchFieldDataSchema(true);
    expect(schema.safeParse(createEmptyScene()).success).toBe(false);
    expect(schema.safeParse(sampleScene()).success).toBe(true);
    expect(schema.safeParse(null).success).toBe(false);
  });

  it('allows empty or missing data when optional', () => {
    const schema = sketchFieldDataSchema(false);
    expect(schema.safeParse(undefined).success).toBe(true);
    expect(schema.safeParse(null).success).toBe(true);
    expect(schema.safeParse(createEmptyScene()).success).toBe(true);
    expect(schema.safeParse(sampleScene()).success).toBe(true);
  });
});
