// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom/vitest';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {LayerLocationHint} from './LayerLocationHint';
import {MapControlThemeProvider} from './mapTheme';

const extent: [number, number, number, number] = [
  151.2, -33.87, 151.21, -33.86,
];

function renderHint(location: [number, number]) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <MapControlThemeProvider>
        <LayerLocationHint extent={extent} location={location} />
      </MapControlThemeProvider>
    </ThemeProvider>
  );
}

describe('LayerLocationHint', () => {
  it('renders the GPS glyph when the device is on the layer', () => {
    renderHint([151.205, -33.865]);
    expect(
      screen.getByRole('img', {name: 'Current location is on this layer'})
    ).toBeInTheDocument();
    expect(screen.getByText('On map')).toBeInTheDocument();
  });
});
