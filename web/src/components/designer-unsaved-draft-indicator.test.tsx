// SPDX-License-Identifier: Apache-2.0

import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {DesignerUnsavedDraftIndicator} from './designer-unsaved-draft-indicator';

describe('DesignerUnsavedDraftIndicator', () => {
  it('renders Unsaved changes only when visible', () => {
    const {rerender} = render(
      <DesignerUnsavedDraftIndicator visible={false} />
    );
    expect(
      screen.queryByTestId('web-designer-unsaved-changes-indicator')
    ).toBeNull();

    rerender(<DesignerUnsavedDraftIndicator visible />);
    expect(
      screen.getByTestId('web-designer-unsaved-changes-indicator').textContent
    ).toBe('Unsaved changes');
  });

  it('names a live-design change when the draft is stale', () => {
    render(<DesignerUnsavedDraftIndicator visible stale />);
    expect(
      screen.getByTestId('web-designer-unsaved-changes-indicator').textContent
    ).toBe('Unsaved changes — live design has changed');
  });
});
