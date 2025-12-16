import CloudOffIcon from '@mui/icons-material/CloudOff';
import {Box, Paper, Typography} from '@mui/material';
import {useMemo} from 'react';
import {useAttachments} from '../../../../hooks/useAttachment';
import {IMAGE_TYPES} from '../../../../utils';
import {DataViewFieldRender} from '../../../types';
import {TextWrapper} from '../wrappers';

export const TakePhotoRender: DataViewFieldRender = props => {
  // Generate attachment service
  const attachmentService = useMemo(() => {
    return props.renderContext.tools.getAttachmentService();
  }, [props.renderContext.tools.getAttachmentService]);

  const attachments = useAttachments(
    (props.attachments ?? []).map(a => a.attachmentId),
    attachmentService
  );

  // Separate downloaded and not-downloaded attachments
  const notDownloadedCount = attachments.filter(d => !d.data).length;
  const allAttachments = attachments.filter(d => !!d.data).map(d => d.data);

  // Map the attachment documents into presentable images
  const toDisplay = allAttachments.map(att => ({
    contentType: att.metadata.contentType,
    data: att.blob,
    url: att.url,
  }));
  const displayableImages = toDisplay.filter(item =>
    IMAGE_TYPES.includes(item.contentType.toLowerCase())
  );

  return (
    <div>
      {displayableImages.length === 0 && notDownloadedCount === 0 ? (
        <TextWrapper content={'No images to display'}></TextWrapper>
      ) : (
        <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 2}}>
          {displayableImages.map((img, idx) => (
            <img
              key={idx}
              src={img.url}
              alt={`Attachment ${idx + 1}`}
              style={{
                maxWidth: '300px',
                maxHeight: '300px',
                objectFit: 'contain',
              }}
            />
          ))}
          {Array.from({length: notDownloadedCount}).map((_, idx) => (
            <Paper
              key={`placeholder-${idx}`}
              sx={{
                width: '300px',
                height: '300px',
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
              <CloudOffIcon
                sx={{
                  fontSize: 48,
                  color: 'rgba(0, 0, 0, 0.3)',
                }}
              />
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(0, 0, 0, 0.6)',
                  textAlign: 'center',
                }}
              >
                Attachment not synced
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'rgba(0, 0, 0, 0.5)',
                  textAlign: 'center',
                  maxWidth: '250px',
                }}
              >
                To download attachments enable attachment download
              </Typography>
            </Paper>
          ))}
        </Box>
      )}
    </div>
  );
};
