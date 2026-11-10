// SPDX-License-Identifier: Apache-2.0
import {ProjectStatus} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import {config} from '@/constants';
import {projectStatusHelpText} from '@/lib/status-display';
import {projectStatusDisplay} from './project-status';

describe('projectStatusDisplay', () => {
  it('maps open projects to the success label, classes, and tooltip', () => {
    const display = projectStatusDisplay(ProjectStatus.OPEN);

    expect(display.label).toBe('Open');
    expect(display.className).toContain('border-success/40');
    expect(display.className).toContain('bg-success/10');
    expect(display.className).toContain('text-success');
    expect(display.tooltip).toBe(projectStatusHelpText(ProjectStatus.OPEN));
    expect(display.tooltip).toBe(
      `${config.notebookNameCapitalized} is active and available for data collection on user devices.`
    );
  });

  it('maps closed projects to the destructive label, classes, and tooltip', () => {
    const display = projectStatusDisplay(ProjectStatus.CLOSED);

    expect(display.label).toBe('Closed');
    expect(display.className).toContain('border-destructive/40');
    expect(display.className).toContain('bg-destructive/10');
    expect(display.className).toContain('text-destructive');
    expect(display.tooltip).toBe(projectStatusHelpText(ProjectStatus.CLOSED));
    expect(display.tooltip).toBe(
      `${config.notebookNameCapitalized} is read-only. Users will not be able to activate this ${config.notebookName} for data collection.`
    );
  });

  it('maps archived projects to a distinct muted label and tooltip', () => {
    const display = projectStatusDisplay(ProjectStatus.ARCHIVED);

    expect(display.label).toBe('Archived');
    expect(display.className).not.toContain('border-success/40');
    expect(display.className).not.toContain('bg-success/10');
    expect(display.className).not.toContain('text-success');
    expect(display.className).not.toContain('border-destructive/40');
    expect(display.className).not.toContain('bg-destructive/10');
    expect(display.className).not.toContain('text-destructive');
    expect(display.tooltip).toBe(projectStatusHelpText(ProjectStatus.ARCHIVED));
    expect(display.tooltip).toBe(
      `This ${config.notebookName} is archived and hidden from default lists.`
    );
  });
});
