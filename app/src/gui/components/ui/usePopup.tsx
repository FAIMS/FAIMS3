import React, {useState, useCallback} from 'react';
import {Snackbar, Alert, AlertColor} from '@mui/material';

/**
 * Props for the NotifyPopup component
 */
interface PopupProps {
  severity: AlertColor;
  open: boolean;
  message: string;
  onClose: () => void;
}

/**
 * NotifyPopup component that displays an error message in a Snackbar
 */
const NotifyPopup: React.FC<PopupProps> = ({
  open,
  severity,
  message,
  onClose,
}) => (
  <Snackbar
    open={open}
    autoHideDuration={6000}
    onClose={onClose}
    anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
    // This positions it in hard in the middle, bottom of screen, up a bit
    sx={{
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: '600px',
    }}
  >
    <Alert
      onClose={onClose}
      severity={severity}
      variant="filled"
      sx={{
        // Some overrides to make the font bigger etc
        width: '100%',
        '& .MuiAlert-message': {
          fontSize: '1rem',
          padding: '8px 0',
        },
        '& .MuiAlert-icon': {
          fontSize: '24px',
        },
      }}
    >
      {message}
    </Alert>
  </Snackbar>
);

/**
 * Custom hook for managing notification popups
 * @returns An object containing functions and components for notification popup management
 */
const usePopup = () => {
  // State for controlling the visibility of the popup
  const [open, setOpen] = useState<boolean>(false);
  // State for storing the current message and severity
  const [message, setMessage] = useState<string>('');
  const [severity, setSeverity] = useState<AlertColor>('info');

  // Show message with specified severity
  const showNotification = (message: string, severity: AlertColor) => {
    setMessage(message);
    setSeverity(severity);
    setOpen(true);
  };

  const showSuccess = (message: string) => showNotification(message, 'success');
  const showError = (message: string) => showNotification(message, 'error');
  const showInfo = (message: string) => showNotification(message, 'info');
  const showWarning = (message: string) => showNotification(message, 'warning');

  /**
   * Hides the popup
   * @param event - The event that triggered the close action
   * @param reason - The reason for closing the Snackbar
   */
  const hidePopup = useCallback(() => {
    setOpen(false);
  }, []);

  /**
   * Renderer function for the ErrorPopup component
   * @returns JSX.Element | null
   */
  const PopupRenderer = useCallback((): JSX.Element | null => {
    if (!open) return null;
    return (
      <NotifyPopup
        open={open}
        severity={severity}
        message={message}
        onClose={hidePopup}
      />
    );
  }, [open, message, severity, hidePopup]);

  return {
    showSuccess,
    showError,
    showInfo,
    showWarning,
    PopupRenderer,
  };
};

export default usePopup;
