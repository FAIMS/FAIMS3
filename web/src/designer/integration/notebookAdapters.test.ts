/**
 * @file Round-trip tests for notebook adapters: planTemplate survives
 * hydration and export, and null serialises to an absent key.
 */
import {describe, expect, it} from 'vitest';
import type {Notebook} from '../state/initial';
import {CURRENT_NOTEBOOK_UI_SCHEMA_VERSION} from '../state/initial';
import {
  designerHistoryToNotebookDefinition,
  notebookDefinitionToDesignerHistory,
} from './notebookAdapters';

const createDefinition = (): Notebook => ({
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
});

const countedTemplate = {planType: 'Counted', formType: 'FORM1'};

const countedPlan = {
  planType: 'Counted' as const,
  formType: 'FORM1',
  numberRequired: 3,
  allowExtraRecords: false,
};

describe('notebook adapters planTemplate round-trip', () => {
  it('hydrates a definition with planTemplate into designer state', () => {
    const definition = {...createDefinition(), planTemplate: countedTemplate};
    const history = notebookDefinitionToDesignerHistory(definition);
    expect(history.planTemplate).toEqual(countedTemplate);
  });

  it('hydrates a definition without planTemplate as null', () => {
    const history = notebookDefinitionToDesignerHistory(createDefinition());
    expect(history.planTemplate).toBeNull();
  });

  it('exports planTemplate when present', () => {
    const history = notebookDefinitionToDesignerHistory({
      ...createDefinition(),
      planTemplate: countedTemplate,
    });
    const exported = designerHistoryToNotebookDefinition(history);
    expect(exported.planTemplate).toEqual(countedTemplate);
  });

  it('omits the planTemplate key entirely when null', () => {
    const history = notebookDefinitionToDesignerHistory(createDefinition());
    const exported = designerHistoryToNotebookDefinition(history);
    // Absent key, not "planTemplate": null, so saved JSON stays clean
    expect('planTemplate' in exported).toBe(false);
  });

  it('round-trips a full definition unchanged', () => {
    const definition = {...createDefinition(), planTemplate: countedTemplate};
    const exported = designerHistoryToNotebookDefinition(
      notebookDefinitionToDesignerHistory(definition)
    );
    expect(exported).toEqual(definition);
  });
});

describe('notebook adapters plan round-trip', () => {
  it('hydrates a definition with a plan into designer state', () => {
    const history = notebookDefinitionToDesignerHistory({
      ...createDefinition(),
      plan: countedPlan,
    });
    expect(history.plan).toEqual(countedPlan);
  });

  it('hydrates a definition without a plan as null', () => {
    const history = notebookDefinitionToDesignerHistory(createDefinition());
    expect(history.plan).toBeNull();
  });

  it('keeps the plan through an edit and export', () => {
    // Saving a design must not strip the plan the notebook was created with
    const history = notebookDefinitionToDesignerHistory({
      ...createDefinition(),
      plan: countedPlan,
    });
    const edited = {
      ...history,
      uiSpec: {...history.uiSpec, present: {...history.uiSpec.present}},
    };
    expect(designerHistoryToNotebookDefinition(edited).plan).toEqual(
      countedPlan
    );
  });

  it('omits the plan key entirely when null', () => {
    const exported = designerHistoryToNotebookDefinition(
      notebookDefinitionToDesignerHistory(createDefinition())
    );
    expect('plan' in exported).toBe(false);
  });
});
