import CloudOffIcon from '@mui/icons-material/CloudOff';
import ImageIcon from '@mui/icons-material/Image';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import {Box, Paper, Typography} from '@mui/material';
import {useMemo} from 'react';
import {useAttachments} from '../../../../hooks/useAttachment';
import {IMAGE_TYPES} from '../../../../utils';
import {DataViewFieldRender} from '../../../types';
import {TextWrapper} from '../wrappers';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Determines if a file is an image based on MIME type
 */
function isImageFile(contentType: string): boolean {
  return IMAGE_TYPES.includes(contentType.toLowerCase());
}

/**
 * Gets appropriate icon for file type
 */
function getFileIcon(contentType: string) {
  const type = contentType.toLowerCase();

  if (isImageFile(type)) {
    return <ImageIcon sx={{fontSize: 48, color: 'primary.main'}} />;
  }

  if (type === 'application/pdf') {
    return <PictureAsPdfIcon sx={{fontSize: 48, color: 'error.main'}} />;
  }

  if (
    type.includes('spreadsheet') ||
    type.includes('excel') ||
    type === 'text/csv'
  ) {
    return <TableChartIcon sx={{fontSize: 48, color: 'success.main'}} />;
  }

  return <InsertDriveFileIcon sx={{fontSize: 48, color: 'text.secondary'}} />;
}

/**
 * Truncates filename if too long, preserving extension
 */
function truncateFilename(filename: string, maxLength = 25): string {
  if (filename.length <= maxLength) return filename;

  const ext = filename.includes('.') ? filename.split('.').pop() : '';
  const nameWithoutExt = ext
    ? filename.slice(0, filename.lastIndexOf('.'))
    : filename;

  const availableLength = maxLength - (ext ? ext.length + 4 : 3); // 4 for "..." and ".", 3 for just "..."
  return ext
    ? `${nameWithoutExt.slice(0, availableLength)}...${ext}`
    : `${nameWithoutExt.slice(0, availableLength)}...`;
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Renders an image attachment as a thumbnail
 */
const ImageAttachment: React.FC<{
  url: string;
  filename: string;
  index: number;
}> = ({url, filename, index}) => (
  <Box
    sx={{
      position: 'relative',
      width: 150,
      height: 150,
      borderRadius: 1,
      overflow: 'hidden',
      border: '1px solid',
      borderColor: 'divider',
    }}
  >
    <img
      src={url}
      alt={filename || `Attachment ${index + 1}`}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
  </Box>
);

/**
 * Renders a non-image file attachment as an icon card
 */
const FileAttachment: React.FC<{
  filename: string;
  contentType: string;
}> = ({filename, contentType}) => (
  <Paper
    elevation={0}
    sx={{
      width: 150,
      height: 150,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: 'grey.50',
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 1,
      p: 1.5,
      gap: 1,
    }}
  >
    {getFileIcon(contentType)}
    <Typography
      variant="caption"
      sx={{
        textAlign: 'center',
        wordBreak: 'break-word',
        lineHeight: 1.2,
        maxWidth: '100%',
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
      }}
      title={filename}
    >
      {truncateFilename(filename)}
    </Typography>
  </Paper>
);

/**
 * Placeholder for attachments that haven't been synced/downloaded
 */
const UnsyncedPlaceholder: React.FC<{index: number}> = ({}) => (
  <Paper
    elevation={0}
    sx={{
      width: 150,
      height: 150,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: 'rgba(0, 0, 0, 0.05)',
      border: '2px dashed rgba(0, 0, 0, 0.2)',
      borderRadius: 1,
      gap: 0.5,
      p: 1.5,
    }}
  >
    <CloudOffIcon
      sx={{
        fontSize: 36,
        color: 'rgba(0, 0, 0, 0.3)',
      }}
    />
    <Typography
      variant="caption"
      sx={{
        color: 'rgba(0, 0, 0, 0.6)',
        textAlign: 'center',
        fontSize: '0.7rem',
      }}
    >
      Not synced
    </Typography>
  </Paper>
);

// ============================================================================
// Main Component
// ============================================================================

/**
 * View renderer for the FileUploader field
 * Displays uploaded files as thumbnails (images) or icon cards (other files)
 */
export const FileUploaderRender: DataViewFieldRender = props => {
  // Get attachment service from render context
  const attachmentService = useMemo(() => {
    return props.renderContext.tools.getAttachmentService();
  }, [props.renderContext.tools]);

  // Load all attachments for this field
  const attachments = useAttachments(
    (props.attachments ?? []).map(a => a.attachmentId),
    attachmentService
  );

  // Separate loaded and not-loaded attachments
  const loadedAttachments = attachments.filter(d => !!d.data).map(d => d.data!);
  const notDownloadedCount = attachments.filter(d => !d.data).length;

  // Check if there's nothing to display
  const hasNoContent =
    loadedAttachments.length === 0 && notDownloadedCount === 0;

  if (hasNoContent) {
    return <TextWrapper content="No files uploaded" />;
  }

  // Separate images from other files for different rendering
  const imageAttachments = loadedAttachments.filter(att =>
    isImageFile(att.metadata.contentType)
  );
  const otherAttachments = loadedAttachments.filter(
    att => !isImageFile(att.metadata.contentType)
  );

  return (
    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 2}}>
      {/* Render image attachments as thumbnails */}
      {imageAttachments.map((att, idx) => (
        <ImageAttachment
          key={`img-${att.metadata.filename}-${idx}`}
          url={att.url}
          filename={att.metadata.filename}
          index={idx}
        />
      ))}

      {/* Render non-image attachments as icon cards */}
      {otherAttachments.map((att, idx) => (
        <FileAttachment
          key={`file-${att.metadata.filename}-${idx}`}
          filename={att.metadata.filename}
          contentType={att.metadata.contentType}
        />
      ))}

      {/* Render placeholders for unsynced attachments */}
      {Array.from({length: notDownloadedCount}).map((_, idx) => (
        <UnsyncedPlaceholder key={`placeholder-${idx}`} index={idx} />
      ))}
    </Box>
  );
};
