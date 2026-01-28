import {
  TextField as MuiTextField,
  TextFieldProps,
  InputAdornment,
  Box,
  Typography,
} from '@mui/material';
import React from 'react';
import {BaseFieldProps, FormFieldContextProps} from '../../../formModule/types';
import FieldWrapper from './FieldWrapper';
import SpeechToTextButton from '../../../components/SpeechToTextButton';
import useSpeechToText from '../../../components/useSpeechToText';

/**
 * Extended props for the base MUI text field component.
 * These allow customization of the underlying MUI TextField behavior.
 */
export interface BaseMuiTextFieldConfig {
  /** Whether to render as multiline textarea */
  multiline?: boolean;
  /** Number of rows for multiline (used as minRows) */
  rows?: number;
  /** HTML input type (text, email, number, etc.) */
  inputType?: string;
  /** Additional MUI TextField props to pass through */
  muiProps?: Partial<TextFieldProps>;
  /** Enable speech-to-text input */
  enableSpeech?: boolean;
  /** Language for speech recognition (default: 'en-AU') */
  speechLanguage?: string;
  /** Whether to append speech to existing text or replace (default: true for multiline, false for single-line) */
  speechAppendMode?: boolean;
}

export type BaseMuiTextFieldProps = BaseFieldProps &
  FormFieldContextProps &
  BaseMuiTextFieldConfig;

/**
 * Base MUI TextField component that can be configured for various text input types.
 * This component handles:
 * - Single-line text input
 * - Multiline text areas
 * - Email inputs
 * - Other text-based inputs via inputType
 * - Optional speech-to-text input
 *
 * It wraps MUI's TextField with our standard FieldWrapper for consistent styling.
 */
export const BaseMuiTextField: React.FC<BaseMuiTextFieldProps> = props => {
  const {
    // Field context props
    state,
    setFieldData,
    handleBlur,
    // Base field props
    label,
    helperText,
    required,
    advancedHelperText,
    disabled,
    // Configuration props
    multiline = false,
    rows,
    inputType = 'text',
    muiProps = {},
    // Speech configuration
    enableSpeech = false,
    speechLanguage = 'en-AU',
    speechAppendMode,
    config,
  } = props;

  const value = (state.value?.data as string) || '';
  const errors = state.meta.errors as unknown as string[];

  // Determine append mode: default to true for multiline, false for single-line
  const effectiveAppendMode = speechAppendMode ?? multiline;

  // Initialize speech-to-text hook
  const speech = useSpeechToText(
    enableSpeech
      ? {
          language: speechLanguage,
          appendMode: effectiveAppendMode,
          partialResults: true,
          addPunctuation: true,
          debugMode: false,
          onResult: text => {
            setFieldData(text);
          },
          enabled: true,
        }
      : {enabled: false, debugMode: false}
  );

  // Sync speech transcript with field value when value changes externally
  React.useEffect(() => {
    if (value !== speech.transcript && !speech.isListening) {
      speech.setTranscript(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFieldData(event.target.value);
  };

  // Compute display value: show interim results while listening
  const displayValue = React.useMemo(() => {
    if (speech.isListening && speech.interimTranscript) {
      if (effectiveAppendMode && value) {
        return `${value} ${speech.interimTranscript}`;
      }
      return speech.interimTranscript;
    }
    return value;
  }, [
    speech.isListening,
    speech.interimTranscript,
    effectiveAppendMode,
    value,
  ]);

  // Build InputProps with speech button if enabled
  const inputProps = React.useMemo(() => {
    if (!enableSpeech) {
      return muiProps.InputProps;
    }

    return {
      ...muiProps.InputProps,
      endAdornment: (
        <InputAdornment
          position="end"
          sx={multiline ? {alignSelf: 'flex-start', mt: 1} : undefined}
        >
          {muiProps.InputProps?.endAdornment}
          <SpeechToTextButton
            status={speech.status}
            isAvailable={speech.isAvailable}
            hasPermission={speech.hasPermission}
            onClick={speech.toggleListening}
            size="small"
            disabled={disabled}
          />
        </InputAdornment>
      ),
    };
  }, [
    enableSpeech,
    multiline,
    disabled,
    speech.status,
    speech.isAvailable,
    speech.hasPermission,
    speech.toggleListening,
    muiProps.InputProps,
  ]);

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
      errors={errors}
    >
      <Box sx={{position: 'relative'}}>
        <MuiTextField
          value={displayValue}
          fullWidth
          onChange={onChange}
          onBlur={handleBlur}
          variant="outlined"
          disabled={disabled}
          multiline={multiline}
          minRows={rows}
          type={inputType}
          {...muiProps}
          InputProps={inputProps}
          sx={{
            // Highlight border when listening
            ...(speech.isListening && {
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'error.main',
                  borderWidth: 2,
                },
              },
            }),
            ...muiProps.sx,
          }}
        />
        {enableSpeech && speech.isListening && (
          <Typography
            variant="caption"
            sx={{
              color: 'error.main',
              display: 'block',
              mt: 0.5,
              animation: 'blink 1s ease-in-out infinite',
              '@keyframes blink': {
                '0%, 100%': {opacity: 1},
                '50%': {opacity: 0.5},
              },
            }}
          >
            Listening...
          </Typography>
        )}
      </Box>
    </FieldWrapper>
  );
};

export default BaseMuiTextField;
