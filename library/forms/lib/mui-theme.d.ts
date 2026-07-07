import '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    mapControl: {
      groupBackground: string;
      groupShadow: string;
      buttonBackground: string;
      buttonBackgroundHover: string;
      buttonActiveBackground: string;
      buttonActiveBackgroundHover: string;
      buttonForeground: string;
    };
  }

  interface PaletteOptions {
    mapControl?: {
      groupBackground: string;
      groupShadow: string;
      buttonBackground: string;
      buttonBackgroundHover: string;
      buttonActiveBackground: string;
      buttonActiveBackgroundHover: string;
      buttonForeground: string;
    };
  }
}
