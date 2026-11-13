// SPDX-License-Identifier: Apache-2.0

import {ThemeProvider} from '@mui/material/styles';
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import globalTheme from '../theme/index';
import {DesignerDraftStatusLabel} from './designer-draft-status';

describe('DesignerDraftStatusLabel', () => {
  it('hides the indicator before any edits', () => {
    render(
      <ThemeProvider theme={globalTheme}>
        <DesignerDraftStatusLabel status="idle" />
      </ThemeProvider>
    );
    expect(screen.queryByTestId('web-designer-draft-status')).toBeNull();
  });
});
