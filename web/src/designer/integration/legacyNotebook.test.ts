/**
 * @file What a designer document's plan templates look like once normalized:
 * they come off the schema that parsed them, so template mode keeps them and
 * project mode does not.
 */
import {CURRENT_NOTEBOOK_UI_SCHEMA_VERSION} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import {tryNormalizeApiUiSpecification} from './legacyNotebook';

const design = (planTemplates?: unknown) => ({
  metadata: {
    information: {
      notebookVersion: '1.0',
      purposeMarkdown: '',
      projectLeadLabel: '',
      leadInstitution: '',
    },
  },
  uiSpec: {
    fields: {},
    views: {},
    viewsets: {},
    visible_types: [],
    settings: {showQrCodeButton: false},
    schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  },
  ...(planTemplates === undefined ? {} : {planTemplates}),
});

const countedTemplate = {
  planId: 'Counted',
  planType: 'Counted',
  label: ' Field survey ',
  formType: 'Site',
  numberRequired: 2,
};

describe('tryNormalizeApiUiSpecification', () => {
  it('keeps a template’s plan templates, with the label trimmed', () => {
    const result = tryNormalizeApiUiSpecification(
      design([countedTemplate]),
      'template'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.planTemplates).toEqual([
      {...countedTemplate, label: 'Field survey'},
    ]);
  });

  it('drops plan templates from a project, which cannot carry them', () => {
    const result = tryNormalizeApiUiSpecification(
      design([countedTemplate]),
      'project'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).not.toHaveProperty('planTemplates');
  });

  it('warns rather than fails on two plans whose labels only differ by space', () => {
    const result = tryNormalizeApiUiSpecification(
      design([
        countedTemplate,
        {...countedTemplate, planId: 'Counted-2', label: 'Field survey'},
      ]),
      'template'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warning).toContain('Field survey');
  });
});
