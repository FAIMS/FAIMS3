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
      busy={false}
      animationDuration={0}
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
      {...overrides}
    />
  );

describe('DesignerPublishDialog', () => {
  it('warns about existing records only for surveys that have them', () => {
    renderDialog({existingRecordCount: 33});
    const warning = screen.getByTestId('web-designer-publish-records-warning');
    expect(warning.textContent).toMatch(
      new RegExp(`Users have collected data in this ${config.notebookName}`)
    );
    expect(warning.textContent).toMatch(/33 records/);
    expect(warning.textContent).toMatch(/loss of this data/i);
    expect(
      screen.getByText(
        new RegExp(
          `Publishing these changes updates the live ${config.notebookName}`
        )
      )
    ).toBeTruthy();
  });

  it('singularises the record count in the warning banner', () => {
    renderDialog({existingRecordCount: 1});
    expect(
      screen.getByTestId('web-designer-publish-records-warning').textContent
    ).toMatch(/1 record(?!s)/);
  });

  it('does not warn when the survey has no collected records', () => {
    renderDialog({existingRecordCount: 0});
    expect(
      screen.getByText(
        new RegExp(
          `Users will receive this ${config.notebookName} when they reopen or refresh the app`
        )
      )
    ).toBeTruthy();
    expect(
      screen.queryByTestId('web-designer-publish-records-warning')
    ).toBeNull();
    expect(screen.queryByText(/collected data/i)).toBeNull();
    expect(screen.queryByText(/loss of this data/i)).toBeNull();
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
      screen.getByText(
        new RegExp(
          `existing ${config.notebookNamePlural} created from it are not`,
          'i'
        )
      )
    ).toBeTruthy();
    expect(
      screen.queryByTestId('web-designer-publish-records-warning')
    ).toBeNull();
    expect(screen.queryByText(/collected data/i)).toBeNull();
    expect(screen.queryByText(/loss of this data/i)).toBeNull();
  });
});
