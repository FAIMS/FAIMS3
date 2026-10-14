// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom/vitest';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {MapControlThemeProvider} from '../mapTheme';
import {FullscreenControl} from './map-controls';

const theme = createTheme();

function renderControl(
  props: {isFullscreen: boolean; onToggle?: () => void} = {isFullscreen: false}
) {
  const onToggle = props.onToggle ?? vi.fn();
  render(
    <ThemeProvider theme={theme}>
      <MapControlThemeProvider>
        <FullscreenControl
          isFullscreen={props.isFullscreen}
          onToggle={onToggle}
        />
      </MapControlThemeProvider>
    </ThemeProvider>
  );
  return {onToggle};
}

describe('FullscreenControl', () => {
  it('opens with the full screen icon', async () => {
    const user = userEvent.setup();
    const {onToggle} = renderControl({isFullscreen: false});

    const button = screen.getByRole('button', {name: 'Open full screen map'});
    await user.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('shows a close icon while full screen is open', async () => {
    const user = userEvent.setup();
    const {onToggle} = renderControl({isFullscreen: true});

    const button = screen.getByRole('button', {name: 'Close full screen map'});
    await user.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
