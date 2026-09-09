/*
 * Copyright 2026 FAIMS Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {BaseFieldParametersSchema} from '@faims3/data-model';
import BrushIcon from '@mui/icons-material/Brush';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Paper,
  Typography,
  useTheme,
} from '@mui/material';
import type Konva from 'konva';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {z} from 'zod';
import {PhotoLightbox} from '../../../components/PhotoLightbox';
import {FullFormConfig} from '../../../formModule/formManagers/types';
import {FormFieldContextProps} from '../../../formModule/types';
import {useAttachments} from '../../../hooks/useAttachment';
import {SketchRender} from '../../../rendering/fields/view/specialised/Sketch';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';
import {SketchEditor} from './SketchEditor';
import {
  emptySceneForViewport,
  isSceneEmpty,
  parseSketchScene,
  sceneToSvgBlobUrl,
  sketchFieldDataSchema,
  SketchScene,
} from './scene';

const sketchPropsSchema = BaseFieldParametersSchema.extend({});
type SketchProps = z.infer<typeof sketchPropsSchema>;
type SketchFieldProps = SketchProps & FormFieldContextProps;

function rasterizeStage(
  stage: Konva.Stage,
  logicalWidth: number
): Promise<Blob> {
  const pixelRatio = stage.width() > 0 ? logicalWidth / stage.width() : 1;
  return new Promise((resolve, reject) => {
    stage.toBlob({
      mimeType: 'image/png',
      pixelRatio,
      callback: blob => {
        if (!blob) {
          reject(new Error('Failed to rasterize sketch'));
          return;
        }
        resolve(blob);
      },
    });
  });
}

const SketchPreview: React.FC<SketchFieldProps> = props => {
  const {label, helperText, required, advancedHelperText} = props;
  const theme = useTheme();
  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
      errors={props.state.meta.errors as unknown as string[]}
    >
      <SketchFieldBody {...props} persistAttachments={false} />
      <Paper
        sx={{
          mt: 1,
          p: 1.5,
          bgcolor: theme.palette.grey[100],
          textAlign: 'center',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Preview mode — drawings stay on this page only
        </Typography>
      </Paper>
    </FieldWrapper>
  );
};

const SketchFull: React.FC<SketchFieldProps> = props => {
  const {label, helperText, required, advancedHelperText} = props;
  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
      errors={props.state.meta.errors as unknown as string[]}
    >
      <SketchFieldBody {...props} persistAttachments />
    </FieldWrapper>
  );
};

const SketchFieldBody: React.FC<
  SketchFieldProps & {persistAttachments: boolean}
> = ({
  state,
  setFieldData,
  addAttachment,
  removeAttachment,
  setAttachmentSaving,
  config,
  disabled,
  persistAttachments,
}) => {
  const theme = useTheme();
  const [editorOpen, setEditorOpen] = useState(false);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const lastRasterizedRef = useRef<SketchScene | null>(
    isSceneEmpty(parseSketchScene(state.value?.data))
      ? null
      : parseSketchScene(state.value?.data)
  );
  const scene = useMemo(
    () => parseSketchScene(state.value?.data),
    [state.value?.data]
  );
  const hasDrawing = !isSceneEmpty(scene);

  const attachmentService =
    config.mode === 'full'
      ? (config as FullFormConfig).attachmentEngine()
      : null;

  const loaded = useAttachments(
    attachmentService
      ? (state.value?.attachments ?? []).map(a => a.attachmentId)
      : [],
    attachmentService ??
      ({
        loadAttachmentAsBlob: async () => {
          throw new Error('No attachment service');
        },
      } as never)
  );

  const png = loaded.find(q => q.data && !q.isError)?.data;
  const pngError = loaded.some(q => q.isError);
  const pngLoading = loaded.some(q => q.isLoading);

  const [fallbackSvgUrl, setFallbackSvgUrl] = useState<string | null>(null);
  useEffect(() => {
    if (png || !hasDrawing) {
      setFallbackSvgUrl(null);
      return;
    }
    const url = sceneToSvgBlobUrl(scene);
    setFallbackSvgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [hasDrawing, png, scene]);

  const thumbnailUrl = png?.url ?? fallbackSvgUrl;

  const persistScene = useCallback(
    (next: SketchScene) => {
      setFieldData(next);
    },
    [setFieldData]
  );

  const replaceAttachment = useCallback(
    async (sceneToStore: SketchScene, stage: Konva.Stage | null) => {
      if (!persistAttachments) {
        lastRasterizedRef.current = sceneToStore;
        return;
      }

      const existingIds = (state.value?.attachments ?? []).map(
        a => a.attachmentId
      );

      if (isSceneEmpty(sceneToStore)) {
        setAttachmentSaving?.(true);
        try {
          for (const id of existingIds) {
            await removeAttachment({attachmentId: id});
          }
          const empty = emptySceneForViewport();
          setFieldData(empty);
          lastRasterizedRef.current = empty;
        } finally {
          setAttachmentSaving?.(false);
        }
        return;
      }

      if (!stage) {
        setFieldData(sceneToStore);
        return;
      }

      setAttachmentSaving?.(true);
      try {
        const blob = await rasterizeStage(stage, sceneToStore.width);
        for (const id of existingIds) {
          await removeAttachment({attachmentId: id});
        }
        const attachmentId = await addAttachment({
          blob,
          contentType: 'image/png',
          type: 'photo',
          fileFormat: 'png',
        });
        const nextScene = {...sceneToStore, attachmentId};
        setFieldData(nextScene);
        lastRasterizedRef.current = nextScene;
      } finally {
        setAttachmentSaving?.(false);
      }
    },
    [
      addAttachment,
      persistAttachments,
      removeAttachment,
      setAttachmentSaving,
      setFieldData,
      state.value?.attachments,
    ]
  );

  const handleDelete = useCallback(async () => {
    const existingIds = (state.value?.attachments ?? []).map(
      a => a.attachmentId
    );
    if (persistAttachments) {
      setAttachmentSaving?.(true);
      try {
        for (const id of existingIds) {
          await removeAttachment({attachmentId: id});
        }
      } finally {
        setAttachmentSaving?.(false);
      }
    }
    const empty = emptySceneForViewport();
    setFieldData(empty);
    lastRasterizedRef.current = empty;
  }, [
    persistAttachments,
    removeAttachment,
    setAttachmentSaving,
    setFieldData,
    state.value?.attachments,
  ]);

  return (
    <Box sx={{width: '100%'}}>
      {pngError && persistAttachments && (
        <Alert severity="warning" sx={{mb: 2}}>
          The sketch image could not be loaded. Enable attachment download in
          Settings to see the PNG. The drawing is still editable from saved
          strokes.
        </Alert>
      )}

      {!hasDrawing && !png ? (
        <Paper
          sx={{
            padding: theme.spacing(4),
            textAlign: 'center',
            bgcolor: theme.palette.grey[100],
            borderRadius: theme.spacing(2),
          }}
        >
          <BrushIcon sx={{fontSize: 48, color: 'text.secondary', mb: 2}} />
          <Typography variant="h6" gutterBottom>
            No sketch yet
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setEditorOpen(true)}
            disabled={disabled}
            startIcon={<BrushIcon />}
          >
            Draw sketch
          </Button>
        </Paper>
      ) : (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Box
            sx={{
              width: 200,
              height: 200 * (scene.height / scene.width),
              maxHeight: 280,
              borderRadius: 1,
              overflow: 'hidden',
              boxShadow: theme.shadows[2],
              position: 'relative',
              bgcolor: theme.palette.grey[100],
              cursor: disabled ? 'default' : 'pointer',
            }}
            role="button"
            tabIndex={0}
            aria-label="Open sketch"
            onClick={() => {
              if (!disabled) {
                setEditorOpen(true);
              } else if (thumbnailUrl) {
                setViewUrl(thumbnailUrl);
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!disabled) {
                  setEditorOpen(true);
                }
              }
            }}
          >
            {thumbnailUrl ? (
              <Box
                component="img"
                src={thumbnailUrl}
                alt="Sketch thumbnail"
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  bgcolor: '#fff',
                }}
              />
            ) : pngLoading ? (
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Loading…
                </Typography>
              </Box>
            ) : (
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  p: 1,
                }}
              >
                <CloudOffIcon sx={{color: 'text.secondary'}} />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  align="center"
                >
                  Sketch saved
                </Typography>
              </Box>
            )}
            {!disabled && (
              <IconButton
                aria-label="Delete sketch"
                size="small"
                onClick={e => {
                  e.stopPropagation();
                  void handleDelete();
                }}
                sx={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  color: 'white',
                  bgcolor: 'rgba(0,0,0,0.6)',
                  '&:hover': {bgcolor: 'rgba(0,0,0,0.8)'},
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
          <StackButtons
            disabled={!!disabled}
            onEdit={() => setEditorOpen(true)}
            onView={thumbnailUrl ? () => setViewUrl(thumbnailUrl) : undefined}
          />
        </Box>
      )}

      {editorOpen && (
        <SketchEditor
          initialScene={state.value?.data}
          lastRasterizedScene={lastRasterizedRef.current}
          onScenePersist={persistScene}
          onRasterize={replaceAttachment}
          onClose={() => setEditorOpen(false)}
        />
      )}
      {viewUrl && (
        <PhotoLightbox url={viewUrl} onClose={() => setViewUrl(null)} />
      )}
    </Box>
  );
};

const StackButtons: React.FC<{
  disabled: boolean;
  onEdit: () => void;
  onView?: () => void;
}> = ({disabled, onEdit, onView}) => (
  <Box sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
    <Button
      variant="contained"
      startIcon={<BrushIcon />}
      onClick={onEdit}
      disabled={disabled}
    >
      Edit sketch
    </Button>
    {onView && (
      <Button variant="outlined" onClick={onView}>
        View
      </Button>
    )}
  </Box>
);

export const Sketch: React.FC<SketchFieldProps> = props => {
  if (props.config.mode === 'preview') {
    return <SketchPreview {...props} />;
  }
  return <SketchFull {...props} />;
};

export const sketchFieldSpec: FieldInfo = {
  namespace: 'faims-custom',
  name: 'Sketch',
  returns: 'faims-attachment::Files',
  component: Sketch,
  fieldPropsSchema: sketchPropsSchema,
  fieldDataSchemaFunction: (props: SketchProps) =>
    sketchFieldDataSchema(!!props.required),
  isCompleteFunction: formData =>
    !isSceneEmpty(parseSketchScene(formData.data)),
  excludeFromParentDisplay: true,
  view: {
    component: SketchRender,
    config: {},
    attributes: {bypassNullChecks: true, singleColumn: false},
  },
};

export {
  createEmptyScene,
  isSceneEmpty,
  parseSketchScene,
  sketchSceneSchema,
  SKETCH_LOGICAL_HEIGHT,
  SKETCH_LOGICAL_WIDTH,
} from './scene';
