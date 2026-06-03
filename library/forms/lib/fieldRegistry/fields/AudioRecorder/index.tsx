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
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
  maximumNumberOfRecordings: z.number().optional().default(0),
  bitRate: z.number().optional(),
  sampleRate: z.number().optional(),
});

type AudioRecorderProps = z.infer<typeof audioRecorderPropsSchema>;
type AudioRecorderFieldProps = AudioRecorderProps & FormFieldContextProps;

interface FullAudioRecorderFieldProps extends AudioRecorderFieldProps {
  config: FullFormConfig;
}

/** Fallback MIME type and extension used when recording blob has no type */
const FALLBACK_MIME = 'audio/mp4';
const FALLBACK_EXT = 'm4a';

// ============================================================================
// Recording Lock
// ============================================================================

let activeRecordingFieldId: string | null = null;

function acquireRecordingLock(fieldId: string): boolean {
  if (activeRecordingFieldId !== null && activeRecordingFieldId !== fieldId) {
    return false;
  }
  activeRecordingFieldId = fieldId;
  return true;
}

function releaseRecordingLock(fieldId: string): void {
  if (activeRecordingFieldId === fieldId) {
    activeRecordingFieldId = null;
  }
}

function isRecordingLocked(fieldId: string): boolean {
  return activeRecordingFieldId !== null && activeRecordingFieldId !== fieldId;
}

// ============================================================================
// Helpers
// ============================================================================

/** Formats milliseconds as m:ss for display. */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Derives a file extension from a MIME type string. */
function extensionFromMime(mime: string): string {
  const baseMime = mime.split(';')[0].trim();
  const map: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
  };
  return map[baseMime] ?? FALLBACK_EXT;
}

/** Converts plugin's stop result to Blob. */
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
// Recording Controls
// ============================================================================

interface RecordingControlsProps {
  isRecording: boolean;
  isPaused: boolean;
  elapsed: number;
  disabled: boolean;
  atLimit: boolean;
  lockedByOther: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onCancel: () => void;
}

const RecordingControls: React.FC<RecordingControlsProps> = ({
  isRecording,
  isPaused,
  elapsed,
  disabled,
  atLimit,
  lockedByOther,
  onStart,
  onPause,
  onResume,
  onStop,
  onCancel,
}) => {
  return (
    <Box
      sx={
        isRecording
          ? {
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 1300,
              bgcolor: 'background.paper',
              borderTop: 2,
              borderColor: 'error.main',
              py: 1.5,
              px: 3,
              boxShadow: 6,
            }
          : {}
      }
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{alignItems: 'center', flexWrap: 'wrap'}}
      >
        {!isRecording && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<MicIcon />}
            disabled={disabled || atLimit || lockedByOther}
            onClick={onStart}
          >
            Record
          </Button>
        )}
        {isRecording && !isPaused && (
          <Button
            variant="outlined"
            startIcon={<PauseIcon />}
            onClick={onPause}
          >
            Pause
          </Button>
        )}
        {isRecording && isPaused && (
          <Button
            variant="outlined"
            startIcon={<PlayArrowIcon />}
            onClick={onResume}
          >
            Resume
          </Button>
        )}
        {isRecording && (
          <>
            <Button
              variant="contained"
              color="error"
              startIcon={<StopIcon />}
              onClick={onStop}
            >
              Stop
            </Button>
            <Button
              variant="text"
              startIcon={<CancelIcon />}
              onClick={onCancel}
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

      {lockedByOther && !isRecording && (
        <Typography variant="caption" color="text.secondary" sx={{mt: 1}}>
          Another audio field is currently recording.
        </Typography>
      )}
    </Box>
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
    maximumNumberOfRecordings: maxRecordings = 0,
    bitRate,
    sampleRate,
    state,
    fieldId,
    setFieldData,
    addAttachment,
    removeAttachment,
    setAttachmentSaving,
  } = props;

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const isRecordingRef = useRef(false);
  const addAttachmentRef = useRef(addAttachment);
  const setFieldDataRef = useRef(setFieldData);
  const stateRef = useRef(state);
  const triggerRef = useRef(props.trigger);

  useEffect(() => {
    addAttachmentRef.current = addAttachment;
  }, [addAttachment]);
  useEffect(() => {
    setFieldDataRef.current = setFieldData;
  }, [setFieldData]);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    triggerRef.current = props.trigger;
  }, [props.trigger]);

  const attachmentIds = (state.value?.data as string[]) ?? [];
  const atLimit = maxRecordings > 0 && attachmentIds.length >= maxRecordings;
  const lockedByOther = isRecordingLocked(fieldId);

  const attachmentService = useMemo(
    () => props.config.attachmentEngine(),
    [props.config]
  );
  const loadedFiles = useAttachments(
    (state.value?.attachments || []).map(att => att.attachmentId),
    attachmentService
  );

  /** Finalise recording on unmount. Stops recording & saves */
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);

      if (isRecordingRef.current) {
        isRecordingRef.current = false;
        releaseRecordingLock(fieldId);

        CapacitorAudioRecorder.stopRecording()
          .then(async result => {
            const blob = await blobFromResult(result);
            if (!blob) return;

            const typedBlob =
              blob.type && blob.type.length > 0
                ? blob
                : new Blob([blob], {type: FALLBACK_MIME});

            const mime = typedBlob.type || FALLBACK_MIME;
            const newId = await addAttachmentRef.current({
              blob: typedBlob,
              contentType: mime,
              type: 'file',
              fileFormat: extensionFromMime(mime),
            });

            const currentData =
              (stateRef.current.value?.data as string[] | undefined) ?? [];
            setFieldDataRef.current([...currentData, newId]);

            await triggerRef.current.commit();
          })
          .catch(e => {
            logError(e);
          });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Starts 250ms interval that updates elapsed time display. Optional offset to resume from pause. */
  const startTimer = useCallback((from = 0) => {
    startedAtRef.current = Date.now() - from;
    tickRef.current = setInterval(
      () => setElapsed(Date.now() - startedAtRef.current),
      250
    );
  }, []);

  /** Clears the elapsed time interval so the display freezes. */
  const stopTimer = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  /** Requests permissions, acquires the recording lock, and starts recording. */
  const handleStart = useCallback(async () => {
    setError(null);

    if (!acquireRecordingLock(fieldId)) {
      setError('Another audio field is currently recording.');
      return;
    }

    try {
      const perm = await CapacitorAudioRecorder.checkPermissions();
      if (perm.recordAudio !== 'granted') {
        const req = await CapacitorAudioRecorder.requestPermissions();
        if (req.recordAudio !== 'granted') {
          releaseRecordingLock(fieldId);
          setError('Microphone permission denied.');
          return;
        }
      }
      /** Cancel any leftover recording from a previous session. */
      try {
        await CapacitorAudioRecorder.cancelRecording();
      } catch {
        /** No active recording to cancel — safe to ignore. */
      }
      await CapacitorAudioRecorder.startRecording({
        bitRate,
        sampleRate,
      });
      setIsRecording(true);
      isRecordingRef.current = true;
      setIsPaused(false);
      startTimer();
      /** Signal to the form that an attachment operation is in progress. */
      setAttachmentSaving?.(true);
    } catch (e) {
      releaseRecordingLock(fieldId);
      logError(e);
      setError(e instanceof Error ? e.message : 'Failed to start recording.');
    }
  }, [bitRate, sampleRate, startTimer, fieldId, setAttachmentSaving]);

  /** Pauses the active recording and freezes the timer. */
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

  /** Resumes a paused recording and restarts the timer from where it left off. */
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

  /** Discards the current recording without saving. */
  const handleCancel = useCallback(async () => {
    try {
      await CapacitorAudioRecorder.cancelRecording();
    } catch {
      /** Nothing persisted; safe to ignore. */
    }
    stopTimer();
    setIsRecording(false);
    isRecordingRef.current = false;
    setIsPaused(false);
    setElapsed(0);
    releaseRecordingLock(fieldId);
    setAttachmentSaving?.(false);
  }, [stopTimer, fieldId, setAttachmentSaving]);

  /** Stops recording, converts the result to a blob, and saves an attachment. */
  const handleStop = useCallback(async () => {
    stopTimer();
    setIsRecording(false);
    isRecordingRef.current = false;
    setIsPaused(false);
    releaseRecordingLock(fieldId);
    setAttachmentSaving?.(false);
    try {
      const result = await CapacitorAudioRecorder.stopRecording();
      const blob = await blobFromResult(result);
      if (!blob) {
        setError('Recording produced no audio.');
        return;
      }
      const typedBlob =
        blob.type && blob.type.length > 0
          ? blob
          : new Blob([blob], {type: FALLBACK_MIME});

      const mime = typedBlob.type || FALLBACK_MIME;
      const newId = await addAttachment({
        blob: typedBlob,
        contentType: mime,
        type: 'file',
        fileFormat: extensionFromMime(mime),
      });

      const currentData = state.value?.data as string[] | undefined;
      setFieldData([...(currentData ?? []), newId]);
      setElapsed(0);
    } catch (e) {
      logError(e);
      setError(e instanceof Error ? e.message : 'Failed to save recording.');
    }
  }, [
    stopTimer,
    addAttachment,
    setFieldData,
    state.value?.data,
    fieldId,
    setAttachmentSaving,
  ]);

  /** Removes a saved recording by attachment ID. */
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
        <RecordingControls
          isRecording={isRecording}
          isPaused={isPaused}
          elapsed={elapsed}
          disabled={disabled}
          atLimit={atLimit}
          lockedByOther={lockedByOther}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onStop={handleStop}
          onCancel={handleCancel}
        />

        {atLimit && (
          <Typography variant="caption" color="text.secondary" sx={{mt: 1}}>
            Maximum of {maxRecordings} recording
            {maxRecordings === 1 ? '' : 's'} reached.
          </Typography>
        )}

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
                    {`Recording ${idx + 1}`}
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
                    controlsList="nodownload"
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
      <AudioRecorderFull {...props} config={props.config as FullFormConfig} />
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
    if (props.maximumNumberOfRecordings > 0) {
      const max = props.maximumNumberOfRecordings;
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
