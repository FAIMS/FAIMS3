import {
  compileUiSpecConditionals,
  CompiledUiSpecModel,
  HydratedRecordDocument,
  UiSpecModel,
} from '@faims3/data-model';
import {render} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {FieldVisibilityMap, FullFormConfig} from './types';

/**
 * Visibility maps handed to the rendered form, newest last. The mocked
 * FormManager below pushes one per render, which is how these tests observe
 * both what is visible and how often the manager re-rendered.
 */
const visibilityMaps: FieldVisibilityMap[] = [];

vi.mock('./FormManager', () => ({
  FormManager: ({
    fieldVisibilityMap,
  }: {
    fieldVisibilityMap: FieldVisibilityMap;
  }) => {
    visibilityMaps.push(fieldVisibilityMap);
    return null;
  },
}));

vi.mock('./components/FormProgress', () => ({
  LiveFormProgress: () => null,
}));

vi.mock('./navigation/NavigationBreadcrumbs', () => ({
  FormBreadcrumbs: () => null,
}));

vi.mock('./navigation', () => ({
  NavigationButtonsDisplay: () => null,
  useNavigationDataPreparation: () => ({
    navigationType: 'parent',
    explicitParentInfo: undefined,
    impliedParents: [],
    createAnotherChild: undefined,
  }),
  useNavigationLogic: () => ({
    buttons: [],
    onCompleteHandler: {label: 'Finish', onClick: () => {}},
  }),
}));

const {EditableFormManager} = await import('./EditableFormManager');

const meta = {
  annotation: {include: false, label: 'annotation'},
  uncertainty: {include: false, label: 'uncertainty'},
};

/**
 * A one-section form whose second field is visible only while the notebook's
 * custom `mode` metadata reads "review", so the field's visibility turns
 * entirely on the condition context rather than on any form value.
 */
const uiSpec = (): CompiledUiSpecModel => {
  const spec = {
    fields: {
      note: {
        'component-namespace': 'formik-material-ui',
        'component-name': 'TextField',
        'type-returned': 'faims-core::String',
        'component-parameters': {label: 'Note', name: 'note', required: false},
        validationSchema: [['yup.string']],
        initialValue: '',
        meta,
        condition: null,
        persistent: false,
      },
      reviewNote: {
        'component-namespace': 'formik-material-ui',
        'component-name': 'TextField',
        'type-returned': 'faims-core::String',
        'component-parameters': {
          label: 'Review note',
          name: 'reviewNote',
          required: false,
        },
        validationSchema: [['yup.string']],
        initialValue: '',
        meta,
        condition: {
          operator: 'equal',
          field: '_METADATA.mode',
          value: 'review',
        },
        persistent: false,
      },
    },
    views: {
      'FORM-v1': {label: 'Form', fields: ['note', 'reviewNote']},
    },
    viewsets: {
      FORM: {label: 'Form', views: ['FORM-v1']},
    },
    visible_types: ['FORM'],
  } as unknown as UiSpecModel;
  compileUiSpecConditionals(spec);
  return spec as CompiledUiSpecModel;
};

/** A record with no parent, so parent resolution settles without a fetch. */
const existingRecord = {
  created: new Date(0).toISOString(),
  createdBy: 'tester',
  revision: {relationship: {parent: []}},
} as unknown as HydratedRecordDocument;

const config = (spec: CompiledUiSpecModel) =>
  ({
    mode: 'full',
    layout: 'inline',
    platform: 'web',
    mapConfig: () => ({}),
    dataEngine: () => ({
      uiSpec: spec,
      hydrated: {
        getHydratedRecord: async () => existingRecord,
      },
      form: {},
    }),
    attachmentEngine: () => ({}),
    navigation: {
      toRecord: () => {},
      navigateToRecordList: {navigate: () => {}},
      navigateToViewRecord: () => {},
    },
  }) as unknown as FullFormConfig;

const renderManager = (metadataValues: Record<string, string>) => {
  const spec = uiSpec();
  return render(
    <EditableFormManager
      recordId="rec-1"
      activeUser="tester"
      initialData={{}}
      existingRecord={existingRecord}
      metadataValues={metadataValues}
      revisionId="rev-1"
      formId="FORM"
      mode="parent"
      config={config(spec)}
      navigationContext={{mode: 'root'}}
    />
  );
};

/** Fields the form is currently showing, across every visible section. */
const latestVisibleFields = () =>
  Object.values(visibilityMaps[visibilityMaps.length - 1] ?? {}).flat();

const settle = async () => {
  await new Promise(resolve => setTimeout(resolve, 0));
};

describe('EditableFormManager metadata-driven visibility', () => {
  beforeEach(() => {
    visibilityMaps.length = 0;
  });

  it('hides a field whose condition the metadata does not satisfy', async () => {
    renderManager({mode: 'field'});
    await settle();
    expect(latestVisibleFields()).toEqual(['note']);
  });

  it('shows the field once the metadata changes under the open form', async () => {
    const {rerender} = renderManager({mode: 'field'});
    await settle();
    expect(latestVisibleFields()).toEqual(['note']);

    const spec = uiSpec();
    rerender(
      <EditableFormManager
        recordId="rec-1"
        activeUser="tester"
        initialData={{}}
        existingRecord={existingRecord}
        metadataValues={{mode: 'review'}}
        revisionId="rev-1"
        formId="FORM"
        mode="parent"
        config={config(spec)}
        navigationContext={{mode: 'root'}}
      />
    );
    await settle();

    expect(latestVisibleFields()).toEqual(['note', 'reviewNote']);
  });

  it('settles instead of recomputing itself in a loop', async () => {
    renderManager({mode: 'review'});
    await settle();
    const rendersAfterMount = visibilityMaps.length;
    await settle();
    expect(visibilityMaps.length).toBe(rendersAfterMount);
  });

  it('does not re-render when a recompute finds the same fields visible', async () => {
    // The record is refetched whenever the app regains focus, which hands the
    // manager a fresh object and recomputes visibility. Nothing moved, so the
    // form should not render again.
    const {rerender} = renderManager({mode: 'review'});
    await settle();
    const rendersAfterMount = visibilityMaps.length;

    const spec = uiSpec();
    rerender(
      <EditableFormManager
        recordId="rec-1"
        activeUser="tester"
        initialData={{}}
        existingRecord={{...existingRecord}}
        metadataValues={{mode: 'review'}}
        revisionId="rev-1"
        formId="FORM"
        mode="parent"
        config={config(spec)}
        navigationContext={{mode: 'root'}}
      />
    );
    await settle();

    // One render for the new props, and no second one from the recompute they
    // triggered: the map it built holds the same fields, so it is not adopted.
    expect(visibilityMaps.length).toBe(rendersAfterMount + 1);
  });
});
