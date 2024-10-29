import {PaletteOptions, TypeBackground} from '@mui/material/styles';
import {S} from 'vitest/dist/reporters-5f784f42';

declare module '@mui/material/styles' {
  interface TypeBackground {
    draftBackground: string;
    lightBackground: string;
    tabsBackground: string;
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
      dialogText: string;
      hoverBackground: string;
    };
    highlightColor: {
      main: string;
      contrastText: string;
    };
    icon: {
      main: string;
      light: string;
    };
    table?: {
      divider: string;
      rowBorder: string;
      columnSeparator: string;
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
      contrastText: string;
    };

    icon?: {
      main: string;
      light: string;
    };

    progressBar?: {
      background: string;
      complete: string;
    };

    alert?: {
      warningBackground: string;
      warningText: string;
      infoBackground: string;
      infoText: string;
    };

    dialogButton?: {
      cancel: string;
      confirm: string;
      dialogText: string;
      hoverBackground: string;
    };

    table?: {
      divider: string;
      rowBorder: string;
      columnSeparator: string;
    };
  }
}
