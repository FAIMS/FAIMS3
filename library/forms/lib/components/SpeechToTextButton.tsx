import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import MicIcon from '@mui/icons-material/Mic';
import MicNoneIcon from '@mui/icons-material/MicNone';
import MicOffIcon from '@mui/icons-material/MicOff';
import {
  Box,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import React from 'react';
import type {SpeechStatus} from './useSpeechToText';

export interface SpeechToTextButtonProps {
  /** Current speech recognition status */
  status: SpeechStatus;
  /** Whether speech recognition is available */
  isAvailable: boolean;
  /** Whether permission has been granted */
  hasPermission: boolean;
  /** Callback when button is clicked */
  onClick: () => void;
  /** Size of the button */
  size?: 'small' | 'medium' | 'large';
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Custom tooltip text */
  tooltipText?: string;
  /** Show status text below button */
  showStatusText?: boolean;
  /** Custom color when listening */
  listeningColor?: string;
}

/**
 * Get tooltip text based on status
 */
function getTooltipText(
  status: SpeechStatus,
  isAvailable: boolean,
  hasPermission: boolean
): string {
  if (!isAvailable) {
    return 'Speech recognition not available on this device';
  }
  if (!hasPermission) {
    return 'Click to enable voice input';
  }

  switch (status) {
    case 'listening':
      return 'Click to stop listening';
    case 'processing':
      return 'Processing speech...';
    case 'initializing':
      return 'Starting...';
    case 'error':
      return 'Error occurred. Click to retry';
    case 'permission-denied':
      return 'Permission denied. Check app settings';
    case 'unavailable':
      return 'Speech recognition unavailable';
    default:
      return 'Click to start voice input';
  }
}

/**
 * Get status text for display
 */
function getStatusText(status: SpeechStatus): string {
  switch (status) {
    case 'listening':
      return 'Listening...';
    case 'processing':
      return 'Processing...';
    case 'initializing':
      return 'Starting...';
    case 'error':
      return 'Error';
    case 'permission-denied':
      return 'Permission denied';
    case 'unavailable':
      return 'Unavailable';
    default:
      return '';
  }
}

/**
 * A button component for speech-to-text functionality.
 * Shows appropriate icons and states based on speech recognition status.
 *
 * @example
 * ```tsx
 * const { status, isAvailable, hasPermission, toggleListening } = useSpeechToText();
 *
 * <SpeechToTextButton
 *   status={status}
 *   isAvailable={isAvailable}
 *   hasPermission={hasPermission}
 *   onClick={toggleListening}
 * />
 * ```
 */
export const SpeechToTextButton: React.FC<SpeechToTextButtonProps> = ({
  status,
  isAvailable,
  hasPermission,
  onClick,
  size = 'medium',
  disabled = false,
  tooltipText,
  showStatusText = false,
  listeningColor,
}) => {
  const theme = useTheme();

  // If not available - don't have any button
  if (!isAvailable) {
    return null;
  }

  const isListening = status === 'listening';
  const isLoading = status === 'initializing' || status === 'processing';
  const isError = status === 'error' || status === 'permission-denied';
  const isDisabled = disabled || status === 'unavailable';

  const activeColor = listeningColor || theme.palette.error.main;
  const defaultColor = theme.palette.action.active;
  const disabledColor = theme.palette.action.disabled;

  const tooltip =
    tooltipText || getTooltipText(status, isAvailable, hasPermission);
  const statusText = getStatusText(status);

  const getIcon = () => {
    if (status === 'unavailable') {
      return <MicOffIcon />;
    }
    if (isError) {
      return <ErrorOutlineIcon />;
    }
    if (isListening) {
      return <MicIcon />;
    }
    return <MicNoneIcon />;
  };

  const getIconColor = () => {
    if (isDisabled) return disabledColor;
    if (isError) return theme.palette.warning.main;
    if (isListening) return activeColor;
    return defaultColor;
  };

  return (
    <Box
      sx={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Tooltip title={tooltip} arrow>
        <span>
          <IconButton
            onClick={onClick}
            disabled={isDisabled}
            size={size}
            aria-label={tooltip}
            sx={{
              color: getIconColor(),
              position: 'relative',
              '&:hover': {
                backgroundColor: isListening ? `${activeColor}20` : undefined,
              },
              // Pulsing animation when listening
              ...(isListening && {
                animation: 'pulse 1.5s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%': {
                    boxShadow: `0 0 0 0 ${activeColor}40`,
                  },
                  '70%': {
                    boxShadow: `0 0 0 10px ${activeColor}00`,
                  },
                  '100%': {
                    boxShadow: `0 0 0 0 ${activeColor}00`,
                  },
                },
              }),
            }}
          >
            {isLoading ? (
              <CircularProgress size={size === 'small' ? 18 : 24} />
            ) : (
              getIcon()
            )}
          </IconButton>
        </span>
      </Tooltip>

      {showStatusText && statusText && (
        <Typography
          variant="caption"
          sx={{
            color: isError ? theme.palette.warning.main : 'text.secondary',
            mt: 0.5,
          }}
        >
          {statusText}
        </Typography>
      )}
    </Box>
  );
};

export default SpeechToTextButton;
