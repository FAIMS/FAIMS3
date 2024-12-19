/**
 * Notification provider which will render a fixed placement Alert snackbar on
 * demand on any page in the app.
 *
 * Usage:
 *
 *  Use the notification hook in any component const { showSuccess } =
 *  useNotification(); showSuccess('Operation completed successfully!');
 */

import {Alert, AlertColor, Snackbar} from '@mui/material';
import React, {createContext, useState, useCallback, useContext} from 'react';

/**
 * Functions available from context
 */
export type NotificationContextType = {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
  showWarning: (message: string) => void;
};

/**
 * Creates the notification context with undefined as initial value.
 * The actual value will be provided by NotificationProvider.
 */
export const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

/**
 * Custom hook to access the notification context.
 * Provides a cleaner way to access notification functions and ensures
 * the context is being used within a provider.
 *
 * @throws {Error} If used outside of NotificationProvider
 * @returns {NotificationContextType} The notification context value
 */
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      'useNotification must be used within a NotificationProvider'
    );
  }
  return context;
};

/**
 * Props interface for the NotifyPopup component.
 * Defines the required properties for displaying a notification.
 */
interface PopupProps {
  severity: AlertColor; // Type of notification (success, error, info, warning)
  open: boolean; // Controls visibility of the notification
  message: string; // Content of the notification
  onClose: () => void; // Handler for closing the notification
}

/**
 * Internal component that renders the actual notification using Material-UI components.
 * Implements the visual presentation of notifications using Snackbar and Alert components.
 */
const NotifyPopup: React.FC<PopupProps> = ({
  open,
  severity,
  message,
  onClose,
}) => (
  <Snackbar
    open={open}
    autoHideDuration={6000} // Notification will auto-hide after 6 seconds
    onClose={onClose}
    anchorOrigin={{vertical: 'bottom', horizontal: 'center'}} // Position at bottom center
    sx={{
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)', // Center horizontally
      width: '100%',
      maxWidth: '600px', // Limit maximum width
    }}
  >
    <Alert
      onClose={onClose}
      severity={severity}
      variant="filled"
      sx={{
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
 * The NotificationProvider component provides global notification functionality
 * to all child components. It manages the state and methods for showing different
 * types of notifications.
 *
 * @component
 * @param {React.ReactNode} props.children - Child components that will have access to notifications
 */
export const NotificationProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  // State management for notification properties
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<PopupProps['severity']>('info');

  // Callback to hide the notification
  const hidePopup = useCallback(() => {
    setOpen(false);
  }, []);

  /**
   * Base function to show a notification with specified message and severity
   */
  const showNotification = useCallback(
    (message: string, severity: AlertColor) => {
      setMessage(message);
      setSeverity(severity);
      setOpen(true);
    },
    []
  );

  // Specialized notification functions for different severity levels
  const showSuccess = useCallback(
    (message: string) => {
      showNotification(message, 'success');
    },
    [showNotification]
  );

  const showError = useCallback(
    (message: string) => {
      showNotification(message, 'error');
    },
    [showNotification]
  );

  const showInfo = useCallback(
    (message: string) => {
      showNotification(message, 'info');
    },
    [showNotification]
  );

  const showWarning = useCallback(
    (message: string) => {
      showNotification(message, 'warning');
    },
    [showNotification]
  );

  // Provide notification functions to children and render the notification component
  return (
    <NotificationContext.Provider
      value={{
        showSuccess,
        showError,
        showInfo,
        showWarning,
      }}
    >
      {children}
      <NotifyPopup
        open={open}
        severity={severity}
        message={message}
        onClose={hidePopup}
      />
    </NotificationContext.Provider>
  );
};
