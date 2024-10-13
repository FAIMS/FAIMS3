import React, {useState, useCallback} from 'react';
import {Snackbar, Alert} from '@mui/material';

/**
 * Props for the ErrorPopup component
 */
interface ErrorPopupProps {
  open: boolean;
  message: string;
  onClose: () => void;
}

/**
 * ErrorPopup component that displays an error message in a Snackbar
 */
const ErrorPopup: React.FC<ErrorPopupProps> = ({open, message, onClose}) => (
  <Snackbar open={open} autoHideDuration={6000} onClose={onClose}>
    <Alert onClose={onClose} severity="error" sx={{width: '100%'}}>
      {message}
    </Alert>
  </Snackbar>
);

/**
 * Custom hook for managing error popups
 * @returns An object containing functions and components for error popup management
 */
const useErrorPopup = () => {
  // State for controlling the visibility of the error popup
  const [errorOpen, setErrorOpen] = useState<boolean>(false);
  // State for storing the current error message
  const [errorMessage, setErrorMessage] = useState<string>('');

  /**
   * Shows the error popup with the given message
   * @param message - The error message to display
   */
  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    setErrorOpen(true);
  }, []);

  /**
   * Hides the error popup
   * @param event - The event that triggered the close action
   * @param reason - The reason for closing the Snackbar
   */
  const hideError = useCallback(() => {
    setErrorOpen(false);
  }, []);

  /**
   * Renderer function for the ErrorPopup component
   * @returns JSX.Element | null
   */
  const ErrorPopupRenderer = useCallback((): JSX.Element | null => {
    if (!errorOpen) return null;
    return (
      <ErrorPopup open={errorOpen} message={errorMessage} onClose={hideError} />
    );
  }, [errorOpen, errorMessage, hideError]);

  return {
    showError,
    ErrorPopupRenderer,
  };
};

// Type definition for the return value of useErrorPopup
export interface UseErrorPopupReturn {
  /**
   * Function to show an error popup with a specified message
   * @param message - The error message to display
   */
  showError: (message: string) => void;
  /**
   * Component that renders the error popup when needed
   */
  ErrorPopupRenderer: () => JSX.Element | null;
}

export default useErrorPopup;
