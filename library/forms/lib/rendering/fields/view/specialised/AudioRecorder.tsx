import AudioFileIcon from '@mui/icons-material/AudioFile';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import {Box, Paper, Typography} from '@mui/material';
import {useMemo} from 'react';
import {useAttachments} from '../../../../hooks/useAttachment';
import {DataViewFieldRender} from '../../../types';
import {TextWrapper} from '../wrappers';

const AudioClip: React.FC<{url: string; label: string}> = ({url, label}) => (
  <Paper
    elevation={0}
    sx={{
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
      p: 1.5,
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 1,
      width: '100%',
      maxWidth: 400,
    }}
  >
    <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
      <AudioFileIcon color="primary" />
      <Typography variant="body2" sx={{wordBreak: 'break-word'}}>
        {label}
      </Typography>
    </Box>
    <audio
      controls
      controlsList="nodownload"
      src={url}
      style={{width: '100%'}}
      preload="metadata"
    >
      Your browser does not support the audio element.
    </audio>
  </Paper>
);

const UnsyncedPlaceholder: React.FC = () => (
  <Paper
    elevation={0}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      p: 1.5,
      bgcolor: 'rgba(0, 0, 0, 0.05)',
      border: '2px dashed rgba(0, 0, 0, 0.2)',
      borderRadius: 1,
      width: '100%',
      maxWidth: 400,
    }}
  >
    <CloudOffIcon sx={{color: 'rgba(0, 0, 0, 0.3)'}} />
    <Typography variant="caption" sx={{color: 'rgba(0, 0, 0, 0.6)'}}>
      Not synced
    </Typography>
  </Paper>
);

/** View renderer for the AudioRecorder field — displays saved recordings with audio playback. */

export const AudioRecorderRender: DataViewFieldRender = props => {
  const attachmentService = useMemo(() => {
    return props.renderContext.tools.getAttachmentService();
  }, [props.renderContext.tools]);

  const attachments = useAttachments(
    (props.attachments ?? []).map(a => a.attachmentId),
    attachmentService
  );

  const loaded = attachments.filter(d => !!d.data).map(d => d.data!);
  const unsyncedCount = attachments.filter(d => !d.data).length;

  if (loaded.length === 0 && unsyncedCount === 0) {
    return <TextWrapper content="No audio recordings" />;
  }

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
      {loaded.map((att, idx) => (
        <AudioClip
          key={`audio-${att.metadata.filename}-${idx}`}
          url={att.url}
          label={`Recording ${idx + 1}`}
        />
      ))}
      {Array.from({length: unsyncedCount}).map((_, idx) => (
        <UnsyncedPlaceholder key={`placeholder-${idx}`} />
      ))}
    </Box>
  );
};
