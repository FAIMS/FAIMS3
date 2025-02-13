// eslint-disable-next-line @typescript-eslint/no-unused-vars
import {PaletteOptions, TypeBackground} from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Theme {
    themeType: 'bss' | 'default' | 'bubble';
  }

  interface ThemeOptions {
    themeType?: 'bss' | 'default' | 'bubble';
  }
  interface TypeText {
    helpText: string;
  }
  interface TypeBackground {
    draftBackground: string;
    lightBackground: string;
    tabsBackground: string;
  }

  interface Palette {
    stepper?: {
      current: string;
      visited: string;
      error: string;
      notVisited: string;
    };
    progressBar: {
      background: string;
      complete: string;
    };
    alert: {
      warningBackground: string;
      warningText: string;
      infoBackground: string;
      infoText: string;
      successBackground: string;
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
      required: string;
      highlight: string;
    };
    table?: {
      divider: string;
      rowBorder: string;
      columnSeparator: string;
    };
    stepperGradient: string[];
  }

  interface PaletteOptions {
    stepper?: {
      current: string;
      visited: string;
      error: string;
      notVisited: string;
    };
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

    icon: {
      main: string;
      light: string;
      required: string;
      highlight: string;
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
      successBackground: string;
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
