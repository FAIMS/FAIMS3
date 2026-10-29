// SPDX-License-Identifier: Apache-2.0
import {createTheme} from '@mui/material/styles';
import {describe, expect, it} from 'vitest';
import {defaultMapControlPalette, ensureMapControlTheme} from './mapTheme';

describe('ensureMapControlTheme', () => {
  it('fills in mapControl when the host theme omits it', () => {
    const theme = ensureMapControlTheme(createTheme());
    expect(theme.palette.mapControl).toMatchObject(defaultMapControlPalette);
  });

  it('keeps host mapControl overrides and fills missing sheet tokens', () => {
    const theme = ensureMapControlTheme(
      createTheme({
        palette: {
          mapControl: {
            groupBackground: 'white',
            groupShadow: 'none',
            buttonBackground: '#000',
            buttonBackgroundHover: '#111',
            buttonActiveBackground: '#00f',
            buttonActiveBackgroundHover: '#00d',
            buttonForeground: '#fff',
          },
        },
      })
    );
    expect(theme.palette.mapControl.groupShadow).toBe('none');
    expect(theme.palette.mapControl.scrim).toBe(defaultMapControlPalette.scrim);
    expect(theme.palette.mapControl.sheetShadow).toBe(
      defaultMapControlPalette.sheetShadow
    );
    expect(theme.palette.mapControl.locationRing).toBe(
      defaultMapControlPalette.locationRing
    );
    expect(theme.palette.mapControl.satelliteSwatch).toBe(
      defaultMapControlPalette.satelliteSwatch
    );
    expect(theme.palette.mapControl.vectorSwatch).toBe(
      defaultMapControlPalette.vectorSwatch
    );
    expect(theme.palette.mapControl.colorPickerFallback).toBe(
      defaultMapControlPalette.colorPickerFallback
    );
  });
});
