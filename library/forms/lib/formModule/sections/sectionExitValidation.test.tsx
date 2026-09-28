import type {UiSpecModel} from '@faims3/data-model';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';

const microtaskGate = vi.hoisted(() => {
  const real = globalThis.queueMicrotask.bind(globalThis);
  const gate = {
    hold: false,
    queued: [] as Array<() => void>,
    real,
  };
  globalThis.queueMicrotask = (cb: () => void) => {
    if (gate.hold) {
      gate.queued.push(cb);
      return;
    }
    real(cb);
  };
  return gate;
});
import {TAKE_PHOTO_REQUIRED_MESSAGE} from '../../fieldRegistry/fields/TakePhoto/valueSchema';
import {EditableFormManager} from '../formManagers/EditableFormManager';

vi.mock('@capacitor/camera', () => ({
  Camera: {
    getPhoto: vi.fn(),
    pickImages: vi.fn(),
    requestPermissions: vi.fn(),
    checkPermissions: vi.fn(),
  },
  CameraResultType: {Base64: 'base64', Uri: 'uri'},
  CameraSource: {Camera: 'CAMERA'},
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {getPlatform: () => 'web'},
}));

vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {getCurrentPosition: vi.fn()},
}));

vi.mock('@capacitor-community/exif', () => ({
  Exif: {setCoordinates: vi.fn()},
}));

vi.mock('@capgo/capacitor-speech-recognition', () => ({
  SpeechRecognition: {
    available: vi.fn(async () => ({available: false})),
    start: vi.fn(),
    stop: vi.fn(),
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    addListener: vi.fn(),
  },
}));

const fieldMeta = {
  annotation: {include: false, label: 'annotation'},
  uncertainty: {include: false, label: 'uncertainty'},
};

function textField(name: string, label: string) {
  return {
    'component-namespace': 'faims-custom',
    'component-name': 'TextField',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      label,
      name,
      required: false,
      helperText: '',
      enableSpeech: false,
    },
    validationSchema: [['yup.string']],
    initialValue: '',
    meta: fieldMeta,
    condition: null,
    persistent: true,
  };
}

function twoSectionSpec(): UiSpecModel {
  return {
    fields: {
      note: textField('note', 'Note'),
      photos: {
        'component-namespace': 'faims-custom',
        'component-name': 'TakePhoto',
        'type-returned': 'faims-attachment::Files',
        'component-parameters': {
          label: 'Photos',
          name: 'photos',
          required: true,
          helperText: '',
        },
        validationSchema: [['yup.mixed']],
        initialValue: null,
        meta: fieldMeta,
        condition: null,
        persistent: true,
      },
      extra: textField('extra', 'Extra'),
    },
    views: {
      'FORM-v1': {label: 'Details', fields: ['note', 'photos']},
      'FORM-v2': {label: 'More', fields: ['extra']},
    },
    viewsets: {
      FORM: {label: 'Form', views: ['FORM-v1', 'FORM-v2']},
    },
    visible_types: ['FORM'],
  } as UiSpecModel;
}

function renderNewRecordForm() {
  const dataEngine = {
    uiSpec: twoSectionSpec(),
    form: {
      createRevision: vi.fn(async () => ({_id: 'rev-2'})),
      updateRevision: vi.fn(async () => undefined),
      stampUpdatedAtIfNewer: vi.fn(async () => undefined),
    },
    hydrated: {
      getHydratedRecord: vi.fn(async () => ({
        hrid: 'REC-1',
        record: {_id: 'rec-1', formId: 'FORM', type: 'FORM'},
        revision: {_id: 'rev-1', deleted: false, relationship: {parent: []}},
      })),
    },
  };

  const queryClient = new QueryClient({
    defaultOptions: {queries: {retry: false}},
  });

  render(
    <QueryClientProvider client={queryClient}>
      <EditableFormManager
        recordId="rec-1"
        activeUser="user-1"
        revisionId="rev-1"
        formId="FORM"
        mode="new"
        existingRecord={
          {
            hrid: 'REC-1',
            record: {_id: 'rec-1', formId: 'FORM', type: 'FORM'},
            revision: {
              _id: 'rev-1',
              deleted: false,
              relationship: {parent: []},
            },
          } as never
        }
        initialData={{
          note: {data: ''},
          photos: {data: [], attachments: []},
          extra: {data: ''},
        }}
        navigationContext={{mode: 'root'}}
        config={
          {
            mode: 'full',
            layout: 'tabs',
            platform: 'web',
            mapConfig: () => ({}),
            recordId: 'rec-1',
            projectId: 'project-1',
            decodedToken: {globalRoles: [], resourceRoles: []},
            dataEngine: () => dataEngine,
            attachmentEngine: () => ({
              storeAttachmentFromBlob: vi.fn(),
              loadAttachmentAsBlob: vi.fn(),
            }),
            recordMode: 'new',
            navigation: {
              toRecord: vi.fn(),
              getToRecordLink: () => '/record',
              navigateToLink: vi.fn(),
              navigateToRecordList: {label: 'Back', navigate: vi.fn()},
              navigateToViewRecord: vi.fn(),
            },
            appName: 'test-app',
            user: 'user-1',
          } as never
        }
      />
    </QueryClientProvider>
  );
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
});

describe('section exit validates never-focused photos', () => {
  afterEach(() => {
    microtaskGate.hold = false;
    microtaskGate.queued = [];
    globalThis.queueMicrotask = (cb: () => void) => {
      if (microtaskGate.hold) {
        microtaskGate.queued.push(cb);
        return;
      }
      microtaskGate.real(cb);
    };
    vi.restoreAllMocks();
  });

  it('fails an untouched required photo only after the deferred validate', async () => {
    const user = userEvent.setup();
    renderNewRecordForm();

    const noteField = await screen.findByTestId('app-record-field-note');
    const note = noteField.querySelector('input') ?? noteField;
    expect(screen.queryByText(TAKE_PHOTO_REQUIRED_MESSAGE)).toBeNull();

    await user.type(note, 'seen');

    microtaskGate.hold = true;
    await user.click(screen.getAllByRole('button', {name: 'Next'})[0]);

    // The synchronous validate runs before the new isTouched flags are
    // visible, so the required photo is not an error yet.
    expect(screen.queryByText(/1 error/)).toBeNull();
    expect(screen.queryByText(TAKE_PHOTO_REQUIRED_MESSAGE)).toBeNull();

    const queued = microtaskGate.queued.splice(0);
    expect(queued.length).toBeGreaterThan(0);
    microtaskGate.hold = false;
    act(() => {
      for (const cb of queued) cb();
    });

    await waitFor(() => {
      expect(screen.getAllByText(/1 error/).length).toBeGreaterThan(0);
    });

    await user.click(screen.getByRole('tab', {name: /Details/}));
    expect(
      screen.getAllByText(TAKE_PHOTO_REQUIRED_MESSAGE).length
    ).toBeGreaterThan(0);
  });
});
