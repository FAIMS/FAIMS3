import {PaletteOptions, TypeBackground} from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface TypeBackground {
    draftBackground: string;
  }

  interface Palette {
    progressBar: {
      background: string;
      complete: string;
    };
    alert: {
      warningBackground: string;
      warningText: string;
      infoBackground: string;
      infoText: string;
    };
    dialogButton: {
      cancel: string;
      confirm: string;
      confirmText: string;
    };
    highlightColor: {
      main: string;
    };
    icon: {
      main: string;
    };
  }

  interface PaletteOptions {
    primary?: {
      main: string;
      secondMain: string;
      light: string;
      dark: string;
    };

    highlightColor?: {
      main: string;
    };

    icon?: {
      main: string;
    };

    progressBar?: {
      background: string;
      complete: string;
    };

    alert?: {
      warningBackground: string;
      warningText: string; // Text color for warning alerts
      infoBackground: string; // Background color for info alerts
      infoText: string;
    };

    dailogButton?: {
      cancel: string; // Color for Cancel button
      confirm: string; // Color for Confirm/Stop Sync button
      confirmText: string; // Text color for Confirm button
    };
  }
}
