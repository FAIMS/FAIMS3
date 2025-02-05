// eslint-disable-next-line @typescript-eslint/no-unused-vars
import {PaletteOptions, TypeBackground} from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface TypeText {
    helpText: string;
  }
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
    stepperGradient: string[];
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
    stepperGradient?: string[];
  }
}
