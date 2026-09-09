/*
 * Copyright 2026 FAIMS Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import BrushIcon from '@mui/icons-material/Brush';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import CloseIcon from '@mui/icons-material/Close';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import RedoIcon from '@mui/icons-material/Redo';
import SaveIcon from '@mui/icons-material/Save';
import TimelineIcon from '@mui/icons-material/Timeline';
import UndoIcon from '@mui/icons-material/Undo';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type Konva from 'konva';
import debounce from 'lodash/debounce';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ConfirmDialog} from '../../../components/ConfirmDialog';
import {MediaLightbox} from '../../../components/MediaLightbox';
import {SketchCanvas} from './SketchCanvas';
import {
  emptySceneForViewport,
  isSceneEmpty,
  parseSketchScene,
  readSketchViewportCssSize,
  sceneEquals,
  sceneSizeForViewport,
  shouldPreserveSceneSize,
  SKETCH_COLORS,
  SKETCH_STROKE_WIDTHS,
  SketchScene,
  SketchTool,
} from './scene';

const SCENE_SAVE_DEBOUNCE_MS = 300;

export type SketchEditorProps = {
  initialScene: unknown;
  onScenePersist: (scene: SketchScene) => void;
  /** Rasterize PNG and persist attachment. Called on Save and on Close. */
  onRasterize: (scene: SketchScene, stage: Konva.Stage | null) => Promise<void>;
  onClose: () => void;
  /** Scene last written to a PNG attachment (skip re-raster if unchanged). */
  lastRasterizedScene?: SketchScene | null;
};

export const SketchEditor: React.FC<SketchEditorProps> = ({
  initialScene,
  onScenePersist,
  onRasterize,
  onClose,
  lastRasterizedScene = null,
}) => {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const [scene, setScene] = useState<SketchScene>(() => {
    const parsed = parseSketchScene(initialScene);
    if (shouldPreserveSceneSize(parsed)) {
      return parsed;
    }
    return emptySceneForViewport();
  });
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<SketchTool>('pen');
  const [color, setColor] = useState<string>(SKETCH_COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState<number>(
    SKETCH_STROKE_WIDTHS[1]
  );
  const [undoStack, setUndoStack] = useState<SketchScene[]>([]);
  const [redoStack, setRedoStack] = useState<SketchScene[]>([]);
  const [clearOpen, setClearOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const stageRef = useRef<Konva.Stage | null>(null);
  const snapshotRef = useRef<SketchScene>(scene);

  const persistScene = useMemo(
    () =>
      debounce((next: SketchScene) => {
        onScenePersist(next);
      }, SCENE_SAVE_DEBOUNCE_MS),
    [onScenePersist]
  );

  useEffect(() => {
    return () => {
      persistScene.flush();
      persistScene.cancel();
    };
  }, [persistScene]);

  const updateScene = useCallback(
    (next: SketchScene) => {
      setScene(next);
      sceneRef.current = next;
      persistScene(next);
    },
    [persistScene]
  );

  const applyViewportSize = useCallback(() => {
    const current = sceneRef.current;
    if (shouldPreserveSceneSize(current)) {
      return;
    }
    const viewport = readSketchViewportCssSize();
    const chromeH =
      (headerRef.current?.offsetHeight ?? 0) +
      (toolbarRef.current?.offsetHeight ?? 0);
    const pad = canvasAreaRef.current
      ? parseFloat(getComputedStyle(canvasAreaRef.current).paddingTop) +
        parseFloat(getComputedStyle(canvasAreaRef.current).paddingBottom)
      : 16;
    const availW = viewport.width;
    const availH = viewport.height - chromeH - pad;
    if (availW <= 0 || availH <= 0) {
      return;
    }
    const next = sceneSizeForViewport(availW, availH);
    if (current.width === next.width && current.height === next.height) {
      return;
    }
    updateScene({...current, width: next.width, height: next.height});
  }, [updateScene]);

  // New / empty sketches follow the visible viewport (minus chrome).
  useEffect(() => {
    applyViewportSize();
    const rafId = requestAnimationFrame(applyViewportSize);
    const vv = window.visualViewport;
    window.addEventListener('resize', applyViewportSize);
    vv?.addEventListener('resize', applyViewportSize);
    const observer = new ResizeObserver(applyViewportSize);
    if (headerRef.current) {
      observer.observe(headerRef.current);
    }
    if (toolbarRef.current) {
      observer.observe(toolbarRef.current);
    }
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', applyViewportSize);
      vv?.removeEventListener('resize', applyViewportSize);
      observer.disconnect();
    };
  }, [applyViewportSize]);

  const handleEditStart = useCallback(() => {
    snapshotRef.current = sceneRef.current;
  }, []);

  const handleSceneChange = useCallback(
    (next: SketchScene) => {
      updateScene(next);
    },
    [updateScene]
  );

  const pushHistoryIfChanged = useCallback(() => {
    const before = snapshotRef.current;
    const after = sceneRef.current;
    if (sceneEquals(before, after)) {
      return;
    }
    setUndoStack(stack => [...stack.slice(-49), before]);
    setRedoStack([]);
  }, []);

  const handleEditEnd = useCallback(() => {
    pushHistoryIfChanged();
  }, [pushHistoryIfChanged]);

  const undo = useCallback(() => {
    setUndoStack(stack => {
      if (stack.length === 0) {
        return stack;
      }
      const previous = stack[stack.length - 1];
      setRedoStack(redo => [...redo, sceneRef.current]);
      updateScene(previous);
      if (!shouldPreserveSceneSize(previous)) {
        applyViewportSize();
      }
      return stack.slice(0, -1);
    });
  }, [applyViewportSize, updateScene]);

  const redo = useCallback(() => {
    setRedoStack(stack => {
      if (stack.length === 0) {
        return stack;
      }
      const next = stack[stack.length - 1];
      setUndoStack(undo => [...undo, sceneRef.current]);
      updateScene(next);
      return stack.slice(0, -1);
    });
  }, [updateScene]);

  const clearScene = useCallback(() => {
    snapshotRef.current = sceneRef.current;
    const chromeH =
      (headerRef.current?.offsetHeight ?? 0) +
      (toolbarRef.current?.offsetHeight ?? 0);
    updateScene(emptySceneForViewport(chromeH));
    pushHistoryIfChanged();
    setClearOpen(false);
  }, [pushHistoryIfChanged, updateScene]);

  const rasterizeAnd = useCallback(
    async (thenClose: boolean) => {
      persistScene.flush();
      const current = sceneRef.current;
      const unchanged =
        lastRasterizedScene !== null &&
        sceneEquals(current, lastRasterizedScene);
      const empty = isSceneEmpty(current);
      const emptyMatchesRaster =
        empty &&
        (lastRasterizedScene === null || isSceneEmpty(lastRasterizedScene));
      if (!unchanged && !(empty && emptyMatchesRaster)) {
        setSaving(true);
        try {
          await onRasterize(current, stageRef.current);
        } finally {
          setSaving(false);
        }
      }
      if (thenClose) {
        onClose();
      }
    },
    [lastRasterizedScene, onClose, onRasterize, persistScene]
  );

  const handleSave = useCallback(() => {
    void rasterizeAnd(false);
  }, [rasterizeAnd]);

  const handleFinish = useCallback(() => {
    void rasterizeAnd(true);
  }, [rasterizeAnd]);

  return (
    <MediaLightbox
      onClose={handleFinish}
      closeOnBackdrop={false}
      showCloseButton={false}
      closeAriaLabel="Finish sketch"
      paperSx={{backgroundColor: '#1b1b1b'}}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          height: '100%',
          pt: 'max(8px, env(safe-area-inset-top, 0px))',
        }}
      >
        <Stack
          ref={headerRef}
          direction="row"
          spacing={1}
          sx={{
            alignItems: 'center',
            px: 1.5,
            py: 1,
            gap: 1,
            flexWrap: 'wrap',
            flexShrink: 0,
            borderBottom: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <IconButton
            aria-label="Finish sketch"
            onClick={handleFinish}
            disabled={saving}
            sx={{color: 'white'}}
          >
            <CloseIcon />
          </IconButton>
          <Typography
            variant="subtitle1"
            sx={{color: 'white', fontWeight: 600, mr: 1}}
          >
            Sketch
          </Typography>
          <Box sx={{flex: 1}} />
          <Button
            variant="contained"
            color="primary"
            startIcon={
              saving ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <SaveIcon />
              )
            }
            onClick={handleSave}
            disabled={saving}
          >
            Save
          </Button>
        </Stack>

        <Stack
          ref={toolbarRef}
          direction="row"
          spacing={1}
          sx={{
            alignItems: 'center',
            px: 1.5,
            py: 1,
            gap: 1,
            flexWrap: 'wrap',
            flexShrink: 0,
            bgcolor: 'rgba(0,0,0,0.35)',
          }}
        >
          <ToggleButtonGroup
            exclusive
            size="small"
            value={tool}
            onChange={(_e, next: SketchTool | null) => {
              if (next) {
                setTool(next);
              }
            }}
            sx={{
              '& .MuiToggleButton-root': {
                color: 'rgba(255,255,255,0.7)',
                borderColor: 'rgba(255,255,255,0.2)',
              },
              '& .Mui-selected': {
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.16)',
              },
            }}
          >
            <ToggleButton value="pen" aria-label="Ink">
              <Tooltip title="Ink">
                <BrushIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="line" aria-label="Line">
              <Tooltip title="Line">
                <TimelineIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="rect" aria-label="Rectangle">
              <Tooltip title="Rectangle">
                <CropSquareIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="ellipse" aria-label="Ellipse">
              <Tooltip title="Ellipse">
                <CircleOutlinedIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="eraser" aria-label="Eraser">
              <Tooltip title="Eraser">
                <HighlightOffIcon />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          <Stack direction="row" spacing={0.5} sx={{alignItems: 'center'}}>
            {SKETCH_COLORS.map(c => (
              <Box
                key={c}
                component="button"
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
                sx={{
                  width: isCompact ? 28 : 32,
                  height: isCompact ? 28 : 32,
                  borderRadius: '50%',
                  bgcolor: c,
                  border:
                    color === c
                      ? '3px solid #90caf9'
                      : c === '#ffffff'
                        ? '1px solid #999'
                        : '1px solid transparent',
                  cursor: 'pointer',
                  p: 0,
                }}
              />
            ))}
          </Stack>

          <ToggleButtonGroup
            exclusive
            size="small"
            value={strokeWidth}
            onChange={(_e, next: number | null) => {
              if (next) {
                setStrokeWidth(next);
              }
            }}
            sx={{
              '& .MuiToggleButton-root': {
                color: 'rgba(255,255,255,0.7)',
                borderColor: 'rgba(255,255,255,0.2)',
                minWidth: 40,
              },
              '& .Mui-selected': {
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.16)',
              },
            }}
          >
            {SKETCH_STROKE_WIDTHS.map(w => (
              <ToggleButton key={w} value={w} aria-label={`Stroke ${w}`}>
                <Box
                  sx={{
                    width: 18,
                    height: Math.max(2, w / 4),
                    bgcolor: 'currentColor',
                    borderRadius: 1,
                  }}
                />
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <IconButton
            aria-label="Undo"
            onClick={undo}
            disabled={undoStack.length === 0 || saving}
            sx={{color: 'white'}}
          >
            <UndoIcon />
          </IconButton>
          <IconButton
            aria-label="Redo"
            onClick={redo}
            disabled={redoStack.length === 0 || saving}
            sx={{color: 'white'}}
          >
            <RedoIcon />
          </IconButton>
          <IconButton
            aria-label="Clear sketch"
            onClick={() => setClearOpen(true)}
            disabled={isSceneEmpty(scene) || saving}
            sx={{color: 'white'}}
          >
            <DeleteSweepIcon />
          </IconButton>
        </Stack>

        <Box
          ref={canvasAreaRef}
          sx={{
            // flex-basis 0 so this slot takes leftover viewport, not the
            // intrinsic 4:3 stage size (which previously collapsed the area).
            flex: '1 1 0px',
            minHeight: 0,
            minWidth: 0,
            height: 0,
            p: {xs: 1, md: 2},
          }}
        >
          <SketchCanvas
            scene={scene}
            tool={tool}
            color={color}
            strokeWidth={strokeWidth}
            onSceneChange={handleSceneChange}
            onEditStart={handleEditStart}
            onEditEnd={handleEditEnd}
            stageRef={stageRef}
          />
        </Box>
      </Box>

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={clearScene}
        title="Clear sketch?"
        confirmLabel="Clear"
        confirmColor="error"
      >
        This removes all strokes from the canvas. You can undo afterwards until
        you close the editor.
      </ConfirmDialog>
    </MediaLightbox>
  );
};
