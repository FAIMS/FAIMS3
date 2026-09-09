/*
 * Copyright 2026 FAIMS Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import type Konva from 'konva';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Ellipse, Layer, Line, Path, Rect, Stage} from 'react-konva';
import {
  createObjectId,
  SketchObject,
  SketchPoint,
  SketchScene,
  SketchTool,
  strokeToSvgPath,
} from './scene';

export type SketchCanvasProps = {
  scene: SketchScene;
  tool: SketchTool;
  color: string;
  strokeWidth: number;
  onSceneChange: (scene: SketchScene) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  stageRef: React.MutableRefObject<Konva.Stage | null>;
};

type Draft =
  | {type: 'stroke'; points: SketchPoint[]}
  | {type: 'line'; x1: number; y1: number; x2: number; y2: number}
  | {type: 'rect'; x: number; y: number; width: number; height: number}
  | {type: 'ellipse'; x: number; y: number; radiusX: number; radiusY: number}
  | null;

function draftToObject(
  draft: Exclude<Draft, null>,
  color: string,
  strokeWidth: number,
  id: string
): SketchObject | null {
  if (draft.type === 'stroke') {
    if (draft.points.length === 0) {
      return null;
    }
    return {
      id,
      type: 'stroke',
      points: draft.points,
      color,
      width: strokeWidth,
    };
  }
  if (draft.type === 'line') {
    if (draft.x1 === draft.x2 && draft.y1 === draft.y2) {
      return null;
    }
    return {...draft, id, color, width: strokeWidth};
  }
  if (draft.type === 'rect') {
    if (Math.abs(draft.width) < 1 && Math.abs(draft.height) < 1) {
      return null;
    }
    return {...draft, id, color, strokeWidth};
  }
  if (Math.abs(draft.radiusX) < 1 && Math.abs(draft.radiusY) < 1) {
    return null;
  }
  return {...draft, id, color, strokeWidth};
}

/**
 * Konva stage in logical scene coordinates, scaled to fit the container.
 */
export const SketchCanvas: React.FC<SketchCanvasProps> = ({
  scene,
  tool,
  color,
  strokeWidth,
  onSceneChange,
  onEditStart,
  onEditEnd,
  stageRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({width: 0, height: 0, scale: 1});
  const drawingRef = useRef(false);
  const objectsAtStrokeStartRef = useRef<SketchObject[]>(scene.objects);
  const draftIdRef = useRef<string>('');
  const draftRef = useRef<Draft>(null);
  const objectsRef = useRef<SketchObject[]>(scene.objects);
  objectsRef.current = scene.objects;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const update = () => {
      const availW = el.clientWidth;
      const availH = el.clientHeight;
      if (availW <= 0 || availH <= 0) {
        return;
      }
      const scale = Math.min(availW / scene.width, availH / scene.height);
      setFit({
        width: Math.floor(scene.width * scale),
        height: Math.floor(scene.height * scale),
        scale,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [scene.width, scene.height]);

  const pointerInScene = useCallback((): SketchPoint | null => {
    const stage = stageRef.current;
    if (!stage) {
      return null;
    }
    const pos = stage.getRelativePointerPosition();
    if (!pos) {
      return null;
    }
    return {
      x: Math.min(scene.width, Math.max(0, pos.x)),
      y: Math.min(scene.height, Math.max(0, pos.y)),
      p: undefined,
    };
  }, [scene.height, scene.width, stageRef]);

  const emitScene = useCallback(
    (objects: SketchObject[]) => {
      onSceneChange({...scene, objects});
    },
    [onSceneChange, scene]
  );

  const eraseAtPointer = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const pos = stage.getPointerPosition();
    if (!pos) {
      return;
    }
    const shape = stage.getIntersection(pos);
    const id = shape?.id();
    if (!id || id === 'sketch-bg') {
      return;
    }
    const next = objectsRef.current.filter(obj => obj.id !== id);
    if (next.length !== objectsRef.current.length) {
      objectsRef.current = next;
      emitScene(next);
    }
  }, [emitScene, stageRef]);

  const handlePointerDown = useCallback(
    (evt: Konva.KonvaEventObject<PointerEvent>) => {
      evt.evt.preventDefault();
      (evt.evt.target as Element | null)?.setPointerCapture?.(
        evt.evt.pointerId
      );
      drawingRef.current = true;
      objectsAtStrokeStartRef.current = objectsRef.current;
      draftIdRef.current = createObjectId();
      onEditStart?.();
      if (tool === 'eraser') {
        eraseAtPointer();
        return;
      }
      const pt = pointerInScene();
      if (!pt) {
        return;
      }
      if (tool === 'pen') {
        draftRef.current = {type: 'stroke', points: [pt]};
      } else if (tool === 'line') {
        draftRef.current = {
          type: 'line',
          x1: pt.x,
          y1: pt.y,
          x2: pt.x,
          y2: pt.y,
        };
      } else if (tool === 'rect') {
        draftRef.current = {
          type: 'rect',
          x: pt.x,
          y: pt.y,
          width: 0,
          height: 0,
        };
      } else {
        draftRef.current = {
          type: 'ellipse',
          x: pt.x,
          y: pt.y,
          radiusX: 0,
          radiusY: 0,
        };
      }
    },
    [eraseAtPointer, onEditStart, pointerInScene, scene.objects, tool]
  );

  const handlePointerMove = useCallback(() => {
    if (!drawingRef.current) {
      return;
    }
    if (tool === 'eraser') {
      eraseAtPointer();
      return;
    }
    const pt = pointerInScene();
    const draft = draftRef.current;
    if (!pt || !draft) {
      return;
    }
    let next: Draft = draft;
    if (draft.type === 'stroke') {
      next = {type: 'stroke', points: [...draft.points, pt]};
    } else if (draft.type === 'line') {
      next = {...draft, x2: pt.x, y2: pt.y};
    } else if (draft.type === 'rect') {
      next = {...draft, width: pt.x - draft.x, height: pt.y - draft.y};
    } else {
      next = {
        ...draft,
        radiusX: Math.abs(pt.x - draft.x),
        radiusY: Math.abs(pt.y - draft.y),
      };
    }
    draftRef.current = next;
    const obj = draftToObject(next, color, strokeWidth, draftIdRef.current);
    if (obj) {
      emitScene([...objectsAtStrokeStartRef.current, obj]);
    }
  }, [color, emitScene, eraseAtPointer, pointerInScene, strokeWidth, tool]);

  const handlePointerUp = useCallback(
    (evt: Konva.KonvaEventObject<PointerEvent>) => {
      (evt.evt.target as Element | null)?.releasePointerCapture?.(
        evt.evt.pointerId
      );
      if (!drawingRef.current) {
        return;
      }
      drawingRef.current = false;
      if (tool === 'eraser') {
        draftRef.current = null;
        onEditEnd?.();
        return;
      }
      const draft = draftRef.current;
      if (draft) {
        const obj = draftToObject(
          draft,
          color,
          strokeWidth,
          draftIdRef.current
        );
        emitScene(
          obj
            ? [...objectsAtStrokeStartRef.current, obj]
            : objectsAtStrokeStartRef.current
        );
      }
      draftRef.current = null;
      onEditEnd?.();
    },
    [color, emitScene, onEditEnd, strokeWidth, tool]
  );

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
        overscrollBehavior: 'contain',
      }}
    >
      {fit.width > 0 && (
        <Stage
          ref={node => {
            stageRef.current = node;
          }}
          width={fit.width}
          height={fit.height}
          scaleX={fit.scale}
          scaleY={fit.scale}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            touchAction: 'none',
            background: scene.background,
            boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
          }}
        >
          <Layer>
            <Rect
              id="sketch-bg"
              x={0}
              y={0}
              width={scene.width}
              height={scene.height}
              fill={scene.background}
              listening={false}
            />
            {scene.objects.map(obj => (
              <SketchObjectNode key={obj.id} object={obj} />
            ))}
          </Layer>
        </Stage>
      )}
    </div>
  );
};

const SketchObjectNode: React.FC<{object: SketchObject}> = ({object}) => {
  if (object.type === 'stroke') {
    const data = strokeToSvgPath(object.points, object.width);
    if (!data) {
      return null;
    }
    return <Path id={object.id} data={data} fill={object.color} />;
  }
  if (object.type === 'line') {
    return (
      <Line
        id={object.id}
        points={[object.x1, object.y1, object.x2, object.y2]}
        stroke={object.color}
        strokeWidth={object.width}
        lineCap="round"
        lineJoin="round"
      />
    );
  }
  if (object.type === 'rect') {
    return (
      <Rect
        id={object.id}
        x={Math.min(object.x, object.x + object.width)}
        y={Math.min(object.y, object.y + object.height)}
        width={Math.abs(object.width)}
        height={Math.abs(object.height)}
        stroke={object.color}
        strokeWidth={object.strokeWidth}
      />
    );
  }
  return (
    <Ellipse
      id={object.id}
      x={object.x}
      y={object.y}
      radiusX={Math.abs(object.radiusX)}
      radiusY={Math.abs(object.radiusY)}
      stroke={object.color}
      strokeWidth={object.strokeWidth}
    />
  );
};
