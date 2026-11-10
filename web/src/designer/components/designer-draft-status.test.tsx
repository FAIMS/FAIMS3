// SPDX-License-Identifier: Apache-2.0

import {ThemeProvider} from '@mui/material/styles';
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import globalTheme from '../theme/index';
import {DesignerDraftStatusLabel} from './designer-draft-status';

describe('DesignerDraftStatusLabel', () => {
  it('shows Saved draft with a green tick', () => {
    render(
      <ThemeProvider theme={globalTheme}>
        <DesignerDraftStatusLabel status="saved" />
      </ThemeProvider>
    );
    expect(screen.getByTestId('web-designer-draft-status').textContent).toBe(
      'Saved draft'
    );
    expect(
      screen.getByTestId('web-designer-draft-status-saved-icon')
    ).toBeTruthy();
  });

  it('shows a saving indicator while the draft write is pending', () => {
    render(
      <ThemeProvider theme={globalTheme}>
        <DesignerDraftStatusLabel status="saving" />
      </ThemeProvider>
    );
    expect(screen.getByTestId('web-designer-draft-status').textContent).toBe(
      'Saving draft…'
    );
    expect(
      screen.getByTestId('web-designer-draft-status-saving-icon')
    ).toBeTruthy();
    expect(
      screen.queryByTestId('web-designer-draft-status-saved-icon')
    ).toBeNull();
  });

  it('shows the error copy with an error icon', () => {
    render(
      <ThemeProvider theme={globalTheme}>
        <DesignerDraftStatusLabel status="error" errorMessage="Disk full" />
      </ThemeProvider>
    );
    expect(screen.getByTestId('web-designer-draft-status').textContent).toBe(
      'Disk full'
    );
    expect(
      screen.getByTestId('web-designer-draft-status-error-icon')
    ).toBeTruthy();
  });
});
