/*
 * Copyright 2026 FAIMS Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import CloudOffIcon from '@mui/icons-material/CloudOff';
import {Box, Paper, Typography} from '@mui/material';
import {useEffect, useMemo, useState} from 'react';
import {PhotoLightbox} from '../../../../components/PhotoLightbox';
import {
  isSceneEmpty,
  parseSketchScene,
  sceneToSvgBlobUrl,
} from '../../../../fieldRegistry/fields/Sketch/scene';
import {useAttachments} from '../../../../hooks/useAttachment';
import {IMAGE_TYPES} from '../../../../utils';
import {DataViewFieldRender} from '../../../types';
import {TextWrapper} from '../wrappers';

/** Record view: thumbnail + uneditable photo lightbox, same as Take Photo. */
export const SketchRender: DataViewFieldRender = props => {
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  const attachmentService = useMemo(() => {
    return props.renderContext.tools.getAttachmentService();
  }, [props.renderContext.tools.getAttachmentService]);

  const attachments = useAttachments(
    (props.attachments ?? []).map(a => a.attachmentId),
    attachmentService
  );

  const scene = parseSketchScene(props.value);
  const hasScene = !isSceneEmpty(scene);

  const loaded = attachments.filter(d => !!d.data).map(d => d.data);
  const notDownloaded = attachments.filter(d => !d.data).length;
  const images = loaded.filter(att =>
    IMAGE_TYPES.includes(att.metadata.contentType.toLowerCase())
  );

  const [fallbackSvg, setFallbackSvg] = useState<string | null>(null);
  useEffect(() => {
    if (images.length > 0 || !hasScene) {
      setFallbackSvg(null);
      return;
    }
    const url = sceneToSvgBlobUrl(scene);
    setFallbackSvg(url);
    return () => URL.revokeObjectURL(url);
  }, [hasScene, images.length, scene]);

  const displayUrl = images[0]?.url ?? fallbackSvg;

  if (!displayUrl && notDownloaded === 0 && !hasScene) {
    return <TextWrapper content="No sketch to display" />;
  }

  return (
    <div>
      {displayUrl ? (
        <Box
          component="img"
          src={displayUrl}
          alt="Sketch"
          role="button"
          tabIndex={0}
          onClick={() => setZoomUrl(displayUrl)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              setZoomUrl(displayUrl);
            }
          }}
          sx={{
            maxWidth: 300,
            maxHeight: 225,
            objectFit: 'contain',
            cursor: 'zoom-in',
            bgcolor: '#fff',
            borderRadius: 1,
            boxShadow: 1,
          }}
        />
      ) : (
        <Paper
          sx={{
            width: 300,
            height: 225,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(0, 0, 0, 0.05)',
            border: '2px dashed rgba(0, 0, 0, 0.2)',
            gap: 1,
            p: 2,
          }}
        >
          <CloudOffIcon sx={{fontSize: 48, color: 'rgba(0, 0, 0, 0.3)'}} />
          <Typography variant="body2" sx={{color: 'rgba(0, 0, 0, 0.6)'}}>
            Attachment not synced
          </Typography>
          <Typography
            variant="caption"
            sx={{color: 'rgba(0, 0, 0, 0.5)', textAlign: 'center'}}
          >
            To download attachments enable attachment download
          </Typography>
        </Paper>
      )}
      {zoomUrl && (
        <PhotoLightbox url={zoomUrl} onClose={() => setZoomUrl(null)} />
      )}
    </div>
  );
};
