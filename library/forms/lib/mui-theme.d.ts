// SPDX-License-Identifier: Apache-2.0
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
      scrim: string;
      sheetShadow: string;
      locationRing: string;
      satelliteSwatch: string;
      vectorSwatch: string;
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
      scrim?: string;
      sheetShadow?: string;
      locationRing?: string;
      satelliteSwatch?: string;
      vectorSwatch?: string;
    };
  }
}
