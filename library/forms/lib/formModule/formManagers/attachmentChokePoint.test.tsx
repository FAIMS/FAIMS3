// SPDX-License-Identifier: Apache-2.0
/**
 * `EditableFormManager.handleAddAttachment` is the single choke point every
 * attachment field goes through. It must refuse blocked (active) content
 * types before touching the attachment engine, regardless of which field UI
 * produced them, while letting camera/audio types through untouched.
 *
 * Driven through the real TakePhoto field: the web photo pipeline is mocked
 * to report a chosen `format`, which TakePhoto turns into `image/<format>`.
 */
import '@testing-library/jest-dom/vitest';
import type {UiSpecModel} from '@faims3/data-model';
import {Camera} from '@capacitor/camera';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {preparePhotoBlobForStorage} from '../../fieldRegistry/fields/TakePhoto/webPhotoFallback';
import {EditableFormManager} from './EditableFormManager';

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

vi.mock('../../fieldRegistry/fields/TakePhoto/webPhotoFallback', async () => {
  const actual = await vi.importActual<
    typeof import('../../fieldRegistry/fields/TakePhoto/webPhotoFallback')
  >('../../fieldRegistry/fields/TakePhoto/webPhotoFallback');
  const {Camera} = await import('@capacitor/camera');
  return {
    ...actual,
    preparePhotoBlobForStorage: vi.fn(),
    pickGalleryPhotos: vi.fn(opts => Camera.pickImages(opts as never)),
  };
});

const meta = {
  annotation: {include: false, label: 'annotation'},
  uncertainty: {include: false, label: 'uncertainty'},
};

function photoSpec(): UiSpecModel {
  return {
    fields: {
      photos: {
        'component-namespace': 'faims-custom',
        'component-name': 'TakePhoto',
        'type-returned': 'faims-attachment::Files',
        exportName: 'photos',
        'component-parameters': {
          label: 'Photos',
          name: 'photos',
          required: false,
          helperText: '',
        },
        validationSchema: [['yup.mixed']],
        initialValue: null,
        meta,
        condition: null,
        persistent: true,
      },
    },
    views: {
      'FORM-v1': {label: 'Form', fields: ['photos']},
    },
    viewsets: {
      FORM: {label: 'Form', views: ['FORM-v1']},
    },
    visible_types: ['FORM'],
  } as UiSpecModel;
}

function renderManager() {
  const hydrated = {
    hrid: 'REC-1',
    record: {_id: 'rec-1', formId: 'FORM', type: 'FORM'},
    revision: {_id: 'rev-1', deleted: false, relationship: {parent: []}},
  };

  const createRevision = vi.fn(async () => ({_id: 'rev-2'}));
  const storeAttachmentFromBlob = vi.fn(
    async ({
      metadata,
    }: {
      metadata: {attachmentDetails: {filename: string; contentType: string}};
    }) => ({
      identifier: {id: 'att-1'},
      metadata: {
        filename: metadata.attachmentDetails.filename,
        contentType: metadata.attachmentDetails.contentType,
      },
    })
  );
  const storeAttachmentFromBase64 = vi.fn();

  const dataEngine = {
    uiSpec: photoSpec(),
    form: {
      createRevision,
      updateRevision: vi.fn(async () => undefined),
      stampUpdatedAtIfNewer: vi.fn(async () => undefined),
    },
    hydrated: {getHydratedRecord: vi.fn(async () => hydrated)},
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
        mode="parent"
        existingRecord={hydrated as never}
        initialData={{photos: {data: [], attachments: []}}}
        navigationContext={{mode: 'root'}}
        config={
          {
            mode: 'full',
            layout: 'inline',
            platform: 'web',
            mapConfig: () => ({}),
            recordId: 'rec-1',
            projectId: 'project-1',
            decodedToken: {globalRoles: [], resourceRoles: []},
            dataEngine: () => dataEngine,
            attachmentEngine: () => ({
              storeAttachmentFromBlob,
              storeAttachmentFromBase64,
              loadAttachmentAsBlob: vi.fn(),
            }),
            recordMode: 'parent',
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

  return {createRevision, storeAttachmentFromBlob, storeAttachmentFromBase64};
}

async function pickOnePhoto(format: string) {
  const user = userEvent.setup();
  vi.mocked(Camera.pickImages).mockResolvedValue({
    photos: [{webPath: 'blob:photo-0', format}],
  } as never);
  vi.mocked(preparePhotoBlobForStorage).mockImplementation(
    async (blob: Blob) => ({photoBlob: blob, format, resized: false})
  );
  await user.click(
    await screen.findByRole('button', {
      name: 'Add photos from gallery, multiple selection allowed',
    })
  );
}

describe('handleAddAttachment content-type choke point', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        blob: async () =>
          new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
            type: 'image/jpeg',
          }),
      }))
    );
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => 'blob:photo',
      revokeObjectURL: () => undefined,
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects image/svg+xml before the attachment engine or revision is touched', async () => {
    const {createRevision, storeAttachmentFromBlob, storeAttachmentFromBase64} =
      renderManager();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        blob: async () => new Blob(['<svg/>'], {type: 'image/svg+xml'}),
      }))
    );

    await pickOnePhoto('svg+xml');

    // TakePhoto now sniffs before the choke point; format `svg+xml` is
    // blocked and nothing reaches the attachment engine.
    await waitFor(() => {
      expect(
        screen.getByText(/SVG and HTML files cannot be uploaded/)
      ).toBeInTheDocument();
    });
    expect(storeAttachmentFromBlob).not.toHaveBeenCalled();
    expect(storeAttachmentFromBase64).not.toHaveBeenCalled();
    expect(createRevision).not.toHaveBeenCalled();
  });

  it('passes image/jpeg through to the attachment engine', async () => {
    const {storeAttachmentFromBlob} = renderManager();

    await pickOnePhoto('jpeg');

    await waitFor(() => {
      expect(storeAttachmentFromBlob).toHaveBeenCalledTimes(1);
    });
    expect(storeAttachmentFromBlob).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          attachmentDetails: expect.objectContaining({
            contentType: 'image/jpeg',
          }),
        }),
      })
    );
  });
});
