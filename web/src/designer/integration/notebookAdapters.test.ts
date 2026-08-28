/**
 * @file Round-trip tests for notebook adapters: planTemplates survive
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

const countedTemplate = {
  planId: 'Counted',
  planType: 'Counted',
  formType: 'FORM1',
};

const countedPlan = {
  planId: 'Counted',
  planType: 'Counted' as const,
  formType: 'FORM1',
  numberRequired: 3,
  allowExtraRecords: false,
};

describe('notebook adapters planTemplates round-trip', () => {
  it('hydrates a definition with planTemplates into designer state', () => {
    const definition = {
      ...createDefinition(),
      planTemplates: [countedTemplate],
    };
    const history = notebookDefinitionToDesignerHistory(definition);
    expect(history.planTemplates).toEqual([countedTemplate]);
  });

  it('hydrates a definition without planTemplates as empty', () => {
    const history = notebookDefinitionToDesignerHistory(createDefinition());
    expect(history.planTemplates).toEqual([]);
  });

  it('exports planTemplates when present', () => {
    const history = notebookDefinitionToDesignerHistory({
      ...createDefinition(),
      planTemplates: [countedTemplate],
    });
    const exported = designerHistoryToNotebookDefinition(history);
    expect(exported.planTemplates).toEqual([countedTemplate]);
  });

  it('omits the planTemplates key entirely when there are none', () => {
    const history = notebookDefinitionToDesignerHistory(createDefinition());
    const exported = designerHistoryToNotebookDefinition(history);
    // Absent key, not "planTemplates": [], so saved JSON stays clean
    expect('planTemplates' in exported).toBe(false);
  });

  it('round-trips a full definition unchanged', () => {
    const definition = {
      ...createDefinition(),
      planTemplates: [countedTemplate],
    };
    const exported = designerHistoryToNotebookDefinition(
      notebookDefinitionToDesignerHistory(definition)
    );
    expect(exported).toEqual(definition);
  });
});

describe('notebook adapters plan round-trip', () => {
  it('hydrates a definition with plans into designer state', () => {
    const history = notebookDefinitionToDesignerHistory({
      ...createDefinition(),
      plans: [countedPlan],
    });
    expect(history.plans).toEqual([countedPlan]);
  });

  it('hydrates a definition without plans as empty', () => {
    const history = notebookDefinitionToDesignerHistory(createDefinition());
    expect(history.plans).toEqual([]);
  });

  it('keeps the plans through an edit and export', () => {
    // Saving a design must not strip the plans the notebook was created with
    const history = notebookDefinitionToDesignerHistory({
      ...createDefinition(),
      plans: [countedPlan],
    });
    const edited = {
      ...history,
      uiSpec: {...history.uiSpec, present: {...history.uiSpec.present}},
    };
    expect(designerHistoryToNotebookDefinition(edited).plans).toEqual([
      countedPlan,
    ]);
  });

  it('omits the plans key entirely when there are none', () => {
    const exported = designerHistoryToNotebookDefinition(
      notebookDefinitionToDesignerHistory(createDefinition())
    );
    expect('plans' in exported).toBe(false);
  });
});
