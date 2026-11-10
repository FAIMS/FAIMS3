// SPDX-License-Identifier: Apache-2.0

import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {config} from '@/constants';
import {DesignerPublishDialog} from './designer-publish-dialog';

const renderDialog = (
  overrides: Partial<Parameters<typeof DesignerPublishDialog>[0]> = {}
) =>
  render(
    <DesignerPublishDialog
      open
      mode="project"
      intent="stay"
      busy={false}
      animationDuration={0}
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
      {...overrides}
    />
  );

describe('DesignerPublishDialog', () => {
  it('warns about existing records only for surveys that have them', () => {
    renderDialog({existingRecordCount: 3});
    expect(
      screen.getByText(
        new RegExp(`This ${config.notebookName} has existing records`)
      )
    ).toBeTruthy();
    expect(screen.getByText(/loss of existing data/i)).toBeTruthy();
  });

  it('does not warn when the survey has no collected records', () => {
    renderDialog({existingRecordCount: 0});
    expect(
      screen.getByText(/field users will receive this design/i)
    ).toBeTruthy();
    expect(screen.queryByText(/has existing records/i)).toBeNull();
    expect(screen.queryByText(/loss of existing data/i)).toBeNull();
  });

  it('adds a live-design-changed sentence when the draft is stale', () => {
    renderDialog({stale: true});
    expect(
      screen.getByText(/the design has changed since this draft was created/i)
    ).toBeTruthy();
  });

  it('exits via the close icon without confirming', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    renderDialog({onCancel, onConfirm});
    fireEvent.click(screen.getByTestId('web-designer-publish-dismiss-button'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not warn for templates, even if a record count is supplied', () => {
    renderDialog({mode: 'template', existingRecordCount: 12});
    expect(
      screen.getByText(/existing projects created from it are not/i)
    ).toBeTruthy();
    expect(screen.queryByText(/has existing records/i)).toBeNull();
    expect(screen.queryByText(/loss of existing data/i)).toBeNull();
  });
});
