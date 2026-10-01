// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom';
import {
  compileUiSpecConditionals,
  CompiledUiSpecModel,
  HydratedRecordDocument,
  UiSpecModel,
} from '@faims3/data-model';
import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {FullFormConfig} from './types';

/**
 * What Finish does when the write ahead of it is refused. The way out has to
 * stay open, and the operator has to be told which failure they are leaving
 * behind, since the banner carrying that message unmounts with the form.
 */

vi.mock('./FormManager', () => ({FormManager: () => null}));
vi.mock('./components/FormProgress', () => ({LiveFormProgress: () => null}));
vi.mock('./navigation/NavigationBreadcrumbs', () => ({
  FormBreadcrumbs: () => null,
}));

/** The primary Finish, rendered so a test can press it. */
const finish = vi.fn();

vi.mock('./navigation', () => ({
  NavigationButtonsDisplay: ({
    buttons,
  }: {
    buttons: {id: string; label: string; onClick: () => void}[];
  }) => (
    <>
      {buttons.map(button => (
        <button key={button.id} onClick={button.onClick}>
          {button.label}
        </button>
      ))}
    </>
  ),
  useNavigationDataPreparation: () => ({
    navigationType: 'parent',
    explicitParentInfo: undefined,
    impliedParents: [],
    createAnotherChild: undefined,
  }),
  useNavigationLogic: () => ({
    buttons: [
      {
        id: 'finish-to-list',
        label: 'Finish Form',
        onClick: finish,
        requiresFinishGuard: true,
      },
    ],
    onCompleteHandler: {label: 'Finish', onClick: finish},
  }),
}));

const {EditableFormManager} = await import('./EditableFormManager');

const meta = {
  annotation: {include: false, label: 'annotation'},
  uncertainty: {include: false, label: 'uncertainty'},
};

const uiSpec = () => {
  const spec = {
    fields: {
      note: {
        'component-namespace': 'formik-material-ui',
        'component-name': 'TextField',
        'type-returned': 'faims-core::String',
        'component-parameters': {name: 'note', label: 'Note'},
        meta,
      },
    },
    views: {'FORM-v1': {fields: ['note'], label: 'Section'}},
    viewsets: {FORM: {label: 'Form', views: ['FORM-v1']}},
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

const config = (
  spec: CompiledUiSpecModel,
  stampUpdatedAtIfNewer: () => Promise<void>
) =>
  ({
    mode: 'full',
    layout: 'inline',
    platform: 'web',
    mapConfig: () => ({}),
    dataEngine: () => ({
      uiSpec: spec,
      hydrated: {getHydratedRecord: async () => existingRecord},
      form: {stampUpdatedAtIfNewer},
    }),
    attachmentEngine: () => ({}),
    navigation: {
      toRecord: () => {},
      navigateToRecordList: {navigate: () => {}},
    },
  }) as unknown as FullFormConfig;

/** The manager renders its button row above and below the form, so both copies match. */
const pressFinish = async (user: ReturnType<typeof userEvent.setup>) => {
  const [button] = await screen.findAllByText('Finish Form');
  await user.click(button);
};

const renderManager = (stampUpdatedAtIfNewer: () => Promise<void>) =>
  render(
    <EditableFormManager
      recordId="rec-1"
      activeUser="tester"
      initialData={{}}
      existingRecord={existingRecord}
      revisionId="rev-1"
      formId="FORM"
      mode="parent"
      config={config(uiSpec(), stampUpdatedAtIfNewer)}
      navigationContext={{mode: 'root'}}
    />
  );

describe('Finish when the write is refused', () => {
  beforeEach(() => {
    finish.mockClear();
  });

  it('leaves without a dialog when the flush succeeds', async () => {
    const user = userEvent.setup();
    renderManager(async () => {});
    await pressFinish(user);
    await waitFor(() => expect(finish).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Finish anyway')).not.toBeInTheDocument();
  });

  it('asks first, and says which failure the operator is leaving behind', async () => {
    const user = userEvent.setup();
    renderManager(async () => {
      throw new Error('conflict');
    });
    await pressFinish(user);

    // The message the failing write chose, not a second one invented here: this
    // write succeeded and only its timestamp did not. Scoped to the dialog,
    // because the banner behind it says the same thing until it auto-hides.
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/could not update its timestamp/i)
    ).toBeInTheDocument();
    expect(finish).not.toHaveBeenCalled();
    // No field is wrong, so the cancel names what it does instead.
    expect(screen.getByText('Stay on this record')).toBeInTheDocument();
  });

  it('still lets the operator out, which is what the guard is for', async () => {
    const user = userEvent.setup();
    renderManager(async () => {
      throw new Error('conflict');
    });
    await pressFinish(user);
    await user.click(await screen.findByText('Finish anyway'));
    await waitFor(() => expect(finish).toHaveBeenCalledTimes(1));
  });
});
