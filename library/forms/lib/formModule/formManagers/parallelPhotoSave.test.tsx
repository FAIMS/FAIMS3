import type {UiSpecModel} from '@faims3/data-model';
import {Camera} from '@capacitor/camera';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {MAX_PARALLEL_SAVES} from '../../fieldRegistry/fields/TakePhoto/parallelSaveLimiter';
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
  return {
    ...actual,
    preparePhotoBlobForStorage: vi.fn(async (blob: Blob) => ({
      photoBlob: blob,
      format: 'jpeg',
      resized: false,
    })),
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

describe('parallel photo saves share one revision', () => {
  it('limits concurrent writes and creates a single working revision', async () => {
    const user = userEvent.setup();
    const batch = MAX_PARALLEL_SAVES + 2;
    vi.mocked(Camera.pickImages).mockResolvedValue({
      photos: Array.from({length: batch}, (_, i) => ({
        webPath: `blob:photo-${i}`,
        format: 'jpeg',
      })),
    } as never);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        blob: async () => new Blob(['photo'], {type: 'image/jpeg'}),
      }))
    );
    if (!URL.createObjectURL) {
      URL.createObjectURL = () => 'blob:photo';
    }
    URL.revokeObjectURL = () => undefined;

    let releaseRevision: (revision: {_id: string}) => void = () => undefined;
    const createRevision = vi.fn(
      () =>
        new Promise<{_id: string}>(resolve => {
          releaseRevision = resolve;
        })
    );

    let inFlight = 0;
    let maxInFlight = 0;
    const storeReleases: Array<() => void> = [];
    const revisionIds: string[] = [];
    const storeAttachmentFromBlob = vi.fn(
      async ({metadata}: {metadata: {recordContext: {revisionId: string}}}) => {
        revisionIds.push(metadata.recordContext.revisionId);
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise<void>(resolve => {
          storeReleases.push(() => {
            inFlight -= 1;
            resolve();
          });
        });
        const id = `att-${revisionIds.length}`;
        return {
          identifier: {id},
          metadata: {filename: `${id}.jpeg`, contentType: 'image/jpeg'},
        };
      }
    );

    const hydrated = {
      hrid: 'REC-1',
      record: {_id: 'rec-1', formId: 'FORM', type: 'FORM'},
      revision: {
        _id: 'rev-1',
        deleted: false,
        relationship: {parent: []},
      },
    };

    const dataEngine = {
      uiSpec: photoSpec(),
      form: {
        createRevision,
        updateRevision: vi.fn(async () => undefined),
        stampUpdatedAtIfNewer: vi.fn(async () => undefined),
      },
      hydrated: {
        getHydratedRecord: vi.fn(async () => hydrated),
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

    await user.click(
      await screen.findByRole('button', {
        name: 'Add photos from gallery, multiple selection allowed',
      })
    );

    await waitFor(() => {
      expect(createRevision).toHaveBeenCalledTimes(1);
    });
    expect(storeAttachmentFromBlob).not.toHaveBeenCalled();

    releaseRevision({_id: 'rev-2'});

    await waitFor(() => {
      expect(storeAttachmentFromBlob).toHaveBeenCalledTimes(MAX_PARALLEL_SAVES);
    });
    expect(maxInFlight).toBe(MAX_PARALLEL_SAVES);
    expect(createRevision).toHaveBeenCalledTimes(1);
    expect(revisionIds.every(id => id === 'rev-2')).toBe(true);

    while (storeReleases.length > 0) {
      const pending = storeReleases.splice(0);
      for (const release of pending) release();
      await Promise.resolve();
    }

    await waitFor(() => {
      expect(storeAttachmentFromBlob).toHaveBeenCalledTimes(batch);
    });
    expect(createRevision).toHaveBeenCalledTimes(1);
    expect(revisionIds).toHaveLength(batch);
    expect(revisionIds.every(id => id === 'rev-2')).toBe(true);
    expect(maxInFlight).toBe(MAX_PARALLEL_SAVES);
  });
});
