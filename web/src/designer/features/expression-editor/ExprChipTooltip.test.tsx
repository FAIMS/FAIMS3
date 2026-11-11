// SPDX-License-Identifier: Apache-2.0
/**
 * @file Tooltip rows for field, constant, and error chip models.
 */
import {ThemeProvider} from '@mui/material/styles';
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import globalTheme from '../../theme/index';
import {CHIP_KIND_LABELS, exprTypeLabel, type ChipModel} from './chipModel';
import {ExprChipTooltip} from './ExprChipTooltip';

const renderTooltip = (model: ChipModel) =>
  render(
    <ThemeProvider theme={globalTheme}>
      <ExprChipTooltip model={model} />
    </ThemeProvider>
  );

describe('ExprChipTooltip', () => {
  it('shows kind, export, type, and location for a field chip', () => {
    renderTooltip({
      ref: 'f_abc',
      kind: 'FIELD',
      label: 'Site Name',
      exportName: 'Site-Name',
      exprType: 'number',
      location: 'Form A › Section A',
    });

    expect(screen.getByText(CHIP_KIND_LABELS.FIELD)).toBeTruthy();
    expect(screen.getByText('Label')).toBeTruthy();
    expect(screen.getByText('Site Name')).toBeTruthy();
    expect(screen.getByText('Export')).toBeTruthy();
    expect(screen.getByText('Site-Name')).toBeTruthy();
    expect(screen.getByText('Id')).toBeTruthy();
    expect(screen.getByText('f_abc')).toBeTruthy();
    expect(screen.getByText('Type')).toBeTruthy();
    expect(screen.getByText(exprTypeLabel('number')!)).toBeTruthy();
    expect(screen.getByText('Location')).toBeTruthy();
    expect(screen.getByText('Form A › Section A')).toBeTruthy();
    expect(screen.queryByText('Value')).toBeNull();
  });

  it('shows the constant value and omits empty export/location rows', () => {
    renderTooltip({
      ref: '_CONSTANT.PI',
      kind: 'CONSTANT',
      label: 'PI',
      exprType: 'number',
      constantValue: Math.PI,
    });

    expect(screen.getByText(CHIP_KIND_LABELS.CONSTANT)).toBeTruthy();
    expect(screen.getByText('PI')).toBeTruthy();
    expect(screen.getByText('Value')).toBeTruthy();
    expect(screen.getByText(String(Math.PI))).toBeTruthy();
    expect(screen.queryByText('Export')).toBeNull();
    expect(screen.queryByText('Location')).toBeNull();
  });

  it('renders the error and maps string type to text', () => {
    renderTooltip({
      ref: 'missing',
      kind: 'FIELD',
      label: 'missing',
      exprType: 'string',
      error: 'Unknown reference',
    });

    expect(screen.getByText('Unknown reference')).toBeTruthy();
    expect(screen.getByText(exprTypeLabel('string')!)).toBeTruthy();
    expect(screen.queryByText('Export')).toBeNull();
    expect(screen.queryByText('Location')).toBeNull();
    expect(screen.queryByText('Value')).toBeNull();
  });
});
