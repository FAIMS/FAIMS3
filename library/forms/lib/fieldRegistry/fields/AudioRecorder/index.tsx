import {logError} from '@faims3/data-model';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
import MicIcon from '@mui/icons-material/Mic';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import {Capacitor} from '@capacitor/core';
import {CapacitorAudioRecorder} from '@capgo/capacitor-audio-recorder';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {z} from 'zod';
import {FullFormConfig} from '../../../formModule/formManagers/types';
import {
  BaseFieldPropsSchema,
  FormFieldContextProps,
} from '../../../formModule/types';
import {useAttachments} from '../../../hooks/useAttachment';
import {AudioRecorderRender} from '../../../rendering/fields/view/specialised/AudioRecorder';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';

// ============================================================================
// Types & Schema
// ============================================================================

const audioRecorderPropsSchema = BaseFieldPropsSchema.extend({
  maximum_number_of_recordings: z.number().optional().default(0),
  bitRate: z.number().optional(),
  sampleRate: z.number().optional(),
});

type AudioRecorderProps = z.infer<typeof audioRecorderPropsSchema>;
type AudioRecorderFieldProps = AudioRecorderProps & FormFieldContextProps;

interface FullAudioRecorderFieldProps extends AudioRecorderFieldProps {
  config: FullFormConfig;
}

const AUDIO_MIME = 'audio/mp4';
const AUDIO_EXT = 'm4a';

// ============================================================================
// Helpers
// ============================================================================

/** Formats milliseconds as m:ss for the elapsed time display. */

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Converts the plugin's stop result to a Blob, handling the web/native difference. */

async function blobFromResult(result: {
  blob?: Blob;
  uri?: string;
}): Promise<Blob | null> {
  if (result.blob) return result.blob;
  if (result.uri) {
    const src = Capacitor.convertFileSrc(result.uri);
    const response = await fetch(src);
    return await response.blob();
  }
  return null;
}

// ============================================================================
// Preview
// ============================================================================

const AudioRecorderPreview: React.FC<AudioRecorderFieldProps> = props => {
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
      <Paper
        sx={{
          padding: theme.spacing(4),
          textAlign: 'center',
          bgcolor: theme.palette.grey[100],
          borderRadius: theme.spacing(2),
          marginTop: theme.spacing(2),
        }}
      >
        <UploadFileIcon sx={{fontSize: 48, color: 'text.secondary', mb: 2}} />
        <Typography variant="h6" gutterBottom>
          Audio Recorder (Preview Mode)
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No recordings captured
        </Typography>
      </Paper>
    </FieldWrapper>
  );
};

// ============================================================================
// Full mode
// ============================================================================

const AudioRecorderFull: React.FC<FullAudioRecorderFieldProps> = props => {
  const {
    label,
    helperText,
    required,
    advancedHelperText,
    disabled = false,
    maximum_number_of_recordings: maxRecordings = 0,
    bitRate,
    sampleRate,
    state,
    setFieldData,
    addAttachment,
    removeAttachment,
  } = props;

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);

  const attachmentIds = (state.value?.data as string[]) ?? [];
  const atLimit = maxRecordings > 0 && attachmentIds.length >= maxRecordings;

  // Load attachments for playback
  const attachmentService = props.config.attachmentEngine();
  const loadedFiles = useAttachments(
    (state.value?.attachments || []).map(att => att.attachmentId),
    attachmentService
  );

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const startTimer = useCallback((from = 0) => {
    startedAtRef.current = Date.now() - from;
    tickRef.current = setInterval(
      () => setElapsed(Date.now() - startedAtRef.current),
      250
    );
  }, []);

  const stopTimer = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const handleStart = useCallback(async () => {
    setError(null);
    try {
      const perm = await CapacitorAudioRecorder.checkPermissions();
      if (perm.recordAudio !== 'granted') {
        const req = await CapacitorAudioRecorder.requestPermissions();
        if (req.recordAudio !== 'granted') {
          setError('Microphone permission denied.');
          return;
        }
      }
      // Cancel any leftover recording from a previous session
      try {
        await CapacitorAudioRecorder.cancelRecording();
      } catch {
        // No active recording to cancel — safe to ignore.
      }
      await CapacitorAudioRecorder.startRecording({
        ...(bitRate ? {bitRate} : {}),
        ...(sampleRate ? {sampleRate} : {}),
      });
      setIsRecording(true);
      setIsPaused(false);
      startTimer();
    } catch (e) {
      logError(e);
      setError(e instanceof Error ? e.message : 'Failed to start recording.');
    }
  }, [bitRate, sampleRate, startTimer]);

  const handlePause = useCallback(async () => {
    try {
      await CapacitorAudioRecorder.pauseRecording();
      setIsPaused(true);
      stopTimer();
    } catch (e) {
      logError(e);
      setError(e instanceof Error ? e.message : 'Failed to pause recording.');
    }
  }, [stopTimer]);

  const handleResume = useCallback(async () => {
    try {
      await CapacitorAudioRecorder.resumeRecording();
      setIsPaused(false);
      startTimer(elapsed);
    } catch (e) {
      logError(e);
      setError(e instanceof Error ? e.message : 'Failed to resume recording.');
    }
  }, [elapsed, startTimer]);

  const handleCancel = useCallback(async () => {
    try {
      await CapacitorAudioRecorder.cancelRecording();
    } catch {
      // Nothing persisted; safe to ignore.
    }
    stopTimer();
    setIsRecording(false);
    setIsPaused(false);
    setElapsed(0);
  }, [stopTimer]);

  const handleStop = useCallback(async () => {
    stopTimer();
    setIsRecording(false);
    setIsPaused(false);
    try {
      const result = await CapacitorAudioRecorder.stopRecording();
      const blob = await blobFromResult(result);
      if (!blob) {
        setError('Recording produced no audio.');
        return;
      }
      // Ensure a valid MIME type before handing to the attachment service.
      const typedBlob =
        blob.type && blob.type.length > 0
          ? blob
          : new Blob([blob], {type: AUDIO_MIME});

      const newId = await addAttachment({
        blob: typedBlob,
        contentType: typedBlob.type || AUDIO_MIME,
        type: 'file',
        fileFormat: AUDIO_EXT,
      });

      const currentData = state.value?.data as string[] | undefined;
      setFieldData([...(currentData ?? []), newId]);
      setElapsed(0);
    } catch (e) {
      logError(e);
      setError(e instanceof Error ? e.message : 'Failed to save recording.');
    }
  }, [stopTimer, addAttachment, setFieldData, state.value?.data]);

  const handleRemove = useCallback(
    (attachmentId: string) => {
      removeAttachment({attachmentId});
      const currentData = state.value?.data as string[] | undefined;
      setFieldData((currentData ?? []).filter(id => id !== attachmentId));
      setError(null);
    },
    [removeAttachment, setFieldData, state.value?.data]
  );

  let relevantErrors = state.meta.errors as unknown as string[];
  if (error) {
    relevantErrors = [...relevantErrors, error];
  }

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
      errors={relevantErrors}
    >
      <Box sx={{width: '100%'}}>
        {/* Recording controls */}
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          {!isRecording && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<MicIcon />}
              disabled={disabled || atLimit}
              onClick={handleStart}
            >
              Record
            </Button>
          )}
          {isRecording && !isPaused && (
            <Button
              variant="outlined"
              startIcon={<PauseIcon />}
              onClick={handlePause}
            >
              Pause
            </Button>
          )}
          {isRecording && isPaused && (
            <Button
              variant="outlined"
              startIcon={<PlayArrowIcon />}
              onClick={handleResume}
            >
              Resume
            </Button>
          )}
          {isRecording && (
            <>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<StopIcon />}
                onClick={handleStop}
              >
                Stop
              </Button>
              <Button
                variant="text"
                startIcon={<CancelIcon />}
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Typography
                variant="body2"
                sx={{fontFamily: 'monospace', minWidth: 48}}
              >
                {formatDuration(elapsed)}
              </Typography>
            </>
          )}
        </Stack>

        {/* Limit notice */}
        {atLimit && (
          <Typography variant="caption" color="text.secondary" sx={{mt: 1}}>
            Maximum of {maxRecordings} recording
            {maxRecordings === 1 ? '' : 's'} reached.
          </Typography>
        )}

        {/* Saved recordings list with playback */}
        {attachmentIds.length > 0 && (
          <Stack spacing={1} sx={{mt: 2}}>
            <Typography variant="subtitle2">
              Recordings ({attachmentIds.length})
            </Typography>
            {loadedFiles.map((file, idx) => (
              <Box
                key={attachmentIds[idx]}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 1,
                }}
              >
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                  <MicIcon fontSize="small" color="action" />
                  <Typography variant="body2" sx={{flexGrow: 1}}>
                    {file.data?.metadata?.filename ?? `Recording ${idx + 1}`}
                  </Typography>
                  {!disabled && (
                    <IconButton
                      aria-label="Remove recording"
                      size="small"
                      color="error"
                      onClick={() => handleRemove(attachmentIds[idx])}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
                {file.data?.url && (
                  <audio
                    controls
                    src={file.data.url}
                    style={{width: '100%'}}
                    preload="metadata"
                  />
                )}
                {file.isLoading && (
                  <Typography variant="caption" color="text.secondary">
                    Loading...
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </FieldWrapper>
  );
};

// ============================================================================
// Main export — routes to preview or full mode
// ============================================================================

/** AudioRecorder field component — routes to preview or full mode. */

export const AudioRecorder: React.FC<AudioRecorderFieldProps> = props => {
  if (props.config.mode === 'preview') {
    return <AudioRecorderPreview {...props} />;
  } else if (props.config.mode === 'full') {
    return (
      <AudioRecorderFull
        {...{...props, config: props.config as FullFormConfig}}
      />
    );
  }
  return null;
};

// ============================================================================
// Field registration
// ============================================================================

/** Field specification for registering the AudioRecorder component. */

export const audioRecorderFieldSpec: FieldInfo<AudioRecorderFieldProps> = {
  namespace: 'faims-custom',
  name: 'AudioRecorder',
  returns: 'faims-attachment::Files',
  component: AudioRecorder,
  fieldPropsSchema: audioRecorderPropsSchema,
  fieldDataSchemaFunction: (props: AudioRecorderProps) => {
    let base: z.ZodType<any> = z.array(z.string());
    if (props.required) {
      base = base.refine(val => (val ?? []).length > 0, {
        message: 'At least one audio recording is required.',
      });
    }
    if (props.maximum_number_of_recordings > 0) {
      const max = props.maximum_number_of_recordings;
      base = base.refine(val => val.length <= max, {
        message: `Maximum ${max} recording${max === 1 ? '' : 's'} allowed.`,
      });
    }
    return base;
  },
  view: {
    component: AudioRecorderRender,
    config: {},
    attributes: {singleColumn: true},
  },
};
