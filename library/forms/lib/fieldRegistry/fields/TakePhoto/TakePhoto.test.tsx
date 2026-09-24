/**
 * TakePhoto tests.
 *
 * - Value schema and completeness (`valueSchema`)
 * - Parallel-save limiter (`parallelSaveLimiter`)
 * - Web resize / JPEG fallback (`webPhotoFallback`)
 * - Field UI: form lock, delete during a picker, gallery save cap, and the
 *   delete-vs-append race while saves are in flight
 *
 * Component tests stub `preparePhotoBlobForStorage` so they never touch
 * canvas. The fallback suite loads the real function with `vi.importActual`.
 */

import '@testing-library/jest-dom/vitest';
import {Camera} from '@capacitor/camera';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useMemo, useState} from 'react';
import {z} from 'zod';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  createConcurrencyLimiter,
  DEBUG_SLOW_PHOTOS,
  delayIfSlowPhotosDebug,
  MAX_PARALLEL_SAVES,
} from './parallelSaveLimiter';
import {
  computeWebPhotoTargetSize,
  encodePhotoBlobForWeb,
  IMAGE_QUALITY_0_100,
  MAX_IMAGE_WIDTH,
  WEB_RESIZED_FORMAT,
} from './webPhotoFallback';
import {
  TAKE_PHOTO_REQUIRED_MESSAGE,
  takePhotoIsComplete,
  takePhotoValueSchema,
} from './valueSchema';
import {TakePhoto} from './index';

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

vi.mock('./webPhotoFallback', async () => {
  const actual =
    await vi.importActual<typeof import('./webPhotoFallback')>(
      './webPhotoFallback'
    );
  return {
    ...actual,
    preparePhotoBlobForStorage: vi.fn(async (blob: Blob, format: string) => ({
      photoBlob: blob,
      format,
      resized: false,
    })),
  };
});

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type Deferred<T> = {promise: Promise<T>; resolve: (value: T) => void};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return {promise, resolve};
}

function photoBlob(contents = 'photo') {
  return new Blob([contents], {type: 'image/jpeg'});
}

function queryClient() {
  return new QueryClient({
    defaultOptions: {queries: {retry: false}},
  });
}

/** Canvas stand-in so web encode tests can assert draw size and JPEG quality. */
function stubCanvasEncode({
  sourceWidth,
  sourceHeight,
  result,
}: {
  sourceWidth: number;
  sourceHeight: number;
  result: Blob | null;
}) {
  const close = vi.fn();
  const drawImage = vi.fn();
  const toBlob = vi.fn(
    (cb: (blob: Blob | null) => void, _type?: string, _quality?: number) => {
      cb(result);
    }
  );

  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({
      width: sourceWidth,
      height: sourceHeight,
      close,
    })
  );

  const getContext = vi.fn(() => ({drawImage}));
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((
    tagName: string,
    options?: ElementCreationOptions
  ) => {
    if (tagName === 'canvas') {
      const canvas = originalCreateElement('canvas');
      Object.defineProperty(canvas, 'getContext', {value: getContext});
      Object.defineProperty(canvas, 'toBlob', {value: toBlob});
      return canvas;
    }
    return originalCreateElement(tagName, options);
  }) as typeof document.createElement);

  return {drawImage, toBlob, close, getContext};
}

function stubBrowserPhotoApis() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({blob: async () => photoBlob()}))
  );
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => 'blob:photo',
    revokeObjectURL: () => undefined,
  });
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: {query: vi.fn(async () => ({state: 'granted'}))},
  });
}

function takePhotoConfig() {
  return {
    mode: 'full',
    layout: 'inline',
    platform: 'web',
    mapConfig: () => ({}),
    appName: 'test-app',
    attachmentEngine: () => ({
      loadAttachmentAsBlob: vi.fn(async () => ({
        blob: photoBlob(),
        metadata: {filename: 'existing.jpeg'},
      })),
    }),
  } as never;
}

function renderTakePhoto({
  addAttachment,
  setAttachmentSaving = vi.fn(),
  removeAttachment = vi.fn(async () => undefined),
  withExistingPhoto = false,
}: {
  addAttachment: () => Promise<string>;
  setAttachmentSaving?: (saving: boolean) => void;
  removeAttachment?: (params: {attachmentId: string}) => Promise<void>;
  withExistingPhoto?: boolean;
}) {
  const client = queryClient();

  const attachments = withExistingPhoto
    ? [
        {
          attachmentId: 'att-existing',
          filename: 'existing.jpeg',
          fileType: 'image/jpeg',
        },
      ]
    : [];

  const Wrapper = () => {
    const query = useMemo(() => client, []);
    return (
      <QueryClientProvider client={query}>
        <TakePhoto
          name="photos"
          label="Photos"
          required={false}
          helperText=""
          advancedHelperText=""
          fieldId="photos"
          state={
            {
              value: {
                data: withExistingPhoto ? ['att-existing'] : [],
                attachments,
              },
              meta: {errors: []},
            } as never
          }
          setFieldData={vi.fn()}
          setFieldAnnotation={vi.fn()}
          addAttachment={addAttachment}
          removeAttachment={removeAttachment}
          setAttachmentSaving={setAttachmentSaving}
          handleBlur={vi.fn()}
          trigger={{commit: vi.fn(async () => undefined)}}
          config={takePhotoConfig()}
        />
      </QueryClientProvider>
    );
  };

  render(<Wrapper />);
  return {setAttachmentSaving, removeAttachment};
}

/**
 * Mirrors Field.setFieldData: a function merges against the latest store
 * value; a plain array replaces it. React state lags that store, so a delete
 * that reads props.state.value still sees the pre-append snapshot.
 *
 * `onAppend` runs synchronously inside that updater once the first new id
 * lands, which is when a confirm click can race the remaining saves.
 */
function DeleteRaceHarness({
  store,
  armDeleteOnAppend,
  onAppend,
  addAttachment,
  removeAttachment,
}: {
  store: {current: string[]};
  armDeleteOnAppend: {current: boolean};
  onAppend: () => void;
  addAttachment: () => Promise<string>;
  removeAttachment: (params: {attachmentId: string}) => Promise<void>;
}) {
  const [data, setData] = useState<string[]>(store.current);
  const client = useMemo(() => queryClient(), []);

  const setFieldData = (value: unknown) => {
    const next =
      typeof value === 'function'
        ? (value as (prev: string[] | undefined) => string[])(store.current)
        : (value as string[]);
    store.current = next ?? [];

    if (
      armDeleteOnAppend.current &&
      typeof value === 'function' &&
      store.current.includes('new-1')
    ) {
      armDeleteOnAppend.current = false;
      onAppend();
    }

    setData(store.current.slice());
  };

  return (
    <QueryClientProvider client={client}>
      <TakePhoto
        name="photos"
        label="Photos"
        required={false}
        helperText=""
        advancedHelperText=""
        fieldId="photos"
        state={
          {
            value: {
              data,
              attachments: data.map(id => ({attachmentId: id})),
            },
            meta: {errors: []},
          } as never
        }
        setFieldData={setFieldData}
        setFieldAnnotation={vi.fn()}
        addAttachment={addAttachment}
        removeAttachment={removeAttachment}
        handleBlur={vi.fn()}
        trigger={{commit: vi.fn(async () => undefined)}}
        config={takePhotoConfig()}
      />
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Value schema
// ---------------------------------------------------------------------------

const requiredSchema = () => takePhotoValueSchema({required: true});
const optionalSchema = () => takePhotoValueSchema({required: false});

describe('takePhotoValueSchema', () => {
  it('rejects an untouched required field with the photo minimum message', () => {
    for (const value of [undefined, null, []]) {
      const result = requiredSchema().safeParse(value);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          TAKE_PHOTO_REQUIRED_MESSAGE
        );
      }
    }
  });

  it('does not surface Zod\'s raw "expected array" type error', () => {
    const result = requiredSchema().safeParse(undefined);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).not.toMatch(/expected array/i);
    }
  });

  it('accepts one or more attachment ids when required', () => {
    expect(requiredSchema().safeParse(['att-1']).success).toBe(true);
    expect(requiredSchema().safeParse(['a', 'b']).success).toBe(true);
  });

  it('allows an absent or empty value when the field is optional', () => {
    expect(optionalSchema().safeParse(undefined).success).toBe(true);
    expect(optionalSchema().safeParse(null).success).toBe(true);
    expect(optionalSchema().safeParse([]).success).toBe(true);
    expect(optionalSchema().safeParse(['att-1']).success).toBe(true);
  });

  it('fails a required photo that is missing from compiled form data', () => {
    const formSchema = z.object({photos: requiredSchema()});
    const result = formSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['photos']);
      expect(result.error.issues[0]?.message).toBe(TAKE_PHOTO_REQUIRED_MESSAGE);
    }
  });
});

describe('takePhotoIsComplete', () => {
  it('is incomplete when data is missing, null, or an empty list', () => {
    expect(takePhotoIsComplete({})).toBe(false);
    expect(takePhotoIsComplete({data: undefined})).toBe(false);
    expect(takePhotoIsComplete({data: null})).toBe(false);
    expect(takePhotoIsComplete({data: []})).toBe(false);
  });

  it('is complete when at least one attachment id is stored', () => {
    expect(takePhotoIsComplete({data: ['att-1']})).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Parallel save limiter
// ---------------------------------------------------------------------------

describe('createConcurrencyLimiter', () => {
  it('exposes a module const of 5 parallel photo saves', () => {
    expect(MAX_PARALLEL_SAVES).toBe(5);
  });

  it('grants immediately while under the limit and increments before await', async () => {
    const limiter = createConcurrencyLimiter(2);
    const first = limiter.acquire();
    expect(limiter.active).toBe(1);
    const second = limiter.acquire();
    expect(limiter.active).toBe(2);
    await Promise.all([first, second]);
    expect(limiter.active).toBe(2);
  });

  it('queues callers past the limit and releases in FIFO order', async () => {
    const limiter = createConcurrencyLimiter(2);
    await limiter.acquire();
    await limiter.acquire();

    let thirdGranted = false;
    const third = limiter.acquire().then(() => {
      thirdGranted = true;
    });
    expect(limiter.active).toBe(2);
    expect(thirdGranted).toBe(false);

    limiter.release();
    await third;
    expect(thirdGranted).toBe(true);
    expect(limiter.active).toBe(2);

    limiter.release();
    limiter.release();
    expect(limiter.active).toBe(0);
  });

  it('never runs more than the limit concurrently', async () => {
    const limiter = createConcurrencyLimiter(MAX_PARALLEL_SAVES);
    let running = 0;
    let maxRunning = 0;

    const jobs = Array.from({length: 12}, async () => {
      await limiter.acquire();
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await Promise.resolve();
      running -= 1;
      limiter.release();
    });

    await Promise.all(jobs);
    expect(maxRunning).toBe(MAX_PARALLEL_SAVES);
    expect(limiter.active).toBe(0);
  });
});

describe('DEBUG_SLOW_PHOTOS', () => {
  it('is off by default so device builds are not delayed', () => {
    expect(DEBUG_SLOW_PHOTOS).toBe(false);
  });

  it('resolves immediately when the debug flag is off', async () => {
    const started = Date.now();
    await delayIfSlowPhotosDebug();
    expect(Date.now() - started).toBeLessThan(50);
  });
});

// ---------------------------------------------------------------------------
// Web photo fallback
//
// `preparePhotoBlobForStorage` is mocked above for the component suite.
// These tests bind the real export so canvas behaviour is actually exercised.
// ---------------------------------------------------------------------------

describe('computeWebPhotoTargetSize', () => {
  it('downscales landscape photos so width is 1920 and aspect ratio is kept', () => {
    expect(computeWebPhotoTargetSize(4000, 2000)).toEqual({
      width: 1920,
      height: 960,
      scaled: true,
    });
  });

  it('downscales portrait photos against width, not the long side', () => {
    // Native Camera `width: 1920` constrains width only (height may stay > 1920).
    expect(computeWebPhotoTargetSize(3024, 4032)).toEqual({
      width: 1920,
      height: 2560,
      scaled: true,
    });
  });

  it('leaves already-narrow images at their source size', () => {
    expect(computeWebPhotoTargetSize(800, 600)).toEqual({
      width: 800,
      height: 600,
      scaled: false,
    });
  });

  it('does not scale an image that is exactly max width', () => {
    expect(computeWebPhotoTargetSize(1920, 1080)).toEqual({
      width: 1920,
      height: 1080,
      scaled: false,
    });
  });

  it('accepts an explicit maxWidth override', () => {
    expect(computeWebPhotoTargetSize(4000, 2000, 1000)).toEqual({
      width: 1000,
      height: 500,
      scaled: true,
    });
  });

  it('returns the source size unchanged for invalid dimensions', () => {
    expect(computeWebPhotoTargetSize(0, 100)).toEqual({
      width: 0,
      height: 100,
      scaled: false,
    });
    expect(computeWebPhotoTargetSize(100, -1)).toEqual({
      width: 100,
      height: -1,
      scaled: false,
    });
  });
});

describe('preparePhotoBlobForStorage', () => {
  const original = new Blob(['original-bytes'], {type: 'image/jpeg'});
  let preparePhotoBlobForStorage: typeof import('./webPhotoFallback').preparePhotoBlobForStorage;

  beforeAll(async () => {
    ({preparePhotoBlobForStorage} =
      await vi.importActual<typeof import('./webPhotoFallback')>(
        './webPhotoFallback'
      ));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('passes the blob through unchanged on native platforms', async () => {
    const result = await preparePhotoBlobForStorage(original, 'jpeg', {
      platform: 'ios',
    });
    expect(result).toEqual({
      photoBlob: original,
      format: 'jpeg',
      resized: false,
    });
  });

  it('passes the blob through unchanged on Android', async () => {
    const result = await preparePhotoBlobForStorage(original, 'png', {
      platform: 'android',
    });
    expect(result.photoBlob).toBe(original);
    expect(result.format).toBe('png');
    expect(result.resized).toBe(false);
  });

  it('re-encodes as JPEG on web and reports resized', async () => {
    const encoded = new Blob(['jpeg-bytes'], {type: 'image/jpeg'});
    stubCanvasEncode({
      sourceWidth: 4000,
      sourceHeight: 2000,
      result: encoded,
    });

    const result = await preparePhotoBlobForStorage(original, 'png', {
      platform: 'web',
    });

    expect(result.resized).toBe(true);
    expect(result.format).toBe(WEB_RESIZED_FORMAT);
    expect(result.photoBlob).toBe(encoded);
    expect(result.photoBlob).not.toBe(original);
  });

  it('falls back to the original blob when encode fails on web', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockRejectedValue(new Error('undecodable'))
    );
    vi.stubGlobal(
      'Image',
      class {
        set src(_url: string) {
          queueMicrotask(() => {
            this.onerror?.(new Event('error'));
          });
        }
        onerror: ((ev: Event) => void) | null = null;
        onload: ((ev: Event) => void) | null = null;
      }
    );
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const result = await preparePhotoBlobForStorage(original, 'heic', {
      platform: 'web',
    });

    expect(result).toEqual({
      photoBlob: original,
      format: 'heic',
      resized: false,
    });
  });
});

describe('encodePhotoBlobForWeb', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('draws at the downscaled size and JPEG-encodes at quality 0.6', async () => {
    const encoded = new Blob(['jpeg-bytes'], {type: 'image/jpeg'});
    const {drawImage, toBlob, close} = stubCanvasEncode({
      sourceWidth: 4000,
      sourceHeight: 2000,
      result: encoded,
    });

    const out = await encodePhotoBlobForWeb(
      new Blob(['src'], {type: 'image/jpeg'}),
      {maxWidth: MAX_IMAGE_WIDTH, quality: IMAGE_QUALITY_0_100 / 100}
    );

    expect(out).toBe(encoded);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1920, 960);
    expect(toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/jpeg',
      0.6
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it('still re-encodes when the image is already under the width cap', async () => {
    const encoded = new Blob(['jpeg-bytes'], {type: 'image/jpeg'});
    const {drawImage, toBlob} = stubCanvasEncode({
      sourceWidth: 800,
      sourceHeight: 600,
      result: encoded,
    });

    await encodePhotoBlobForWeb(new Blob(['src'], {type: 'image/jpeg'}), {
      maxWidth: MAX_IMAGE_WIDTH,
      quality: 0.6,
    });

    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 800, 600);
    expect(toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/jpeg',
      0.6
    );
  });

  it('throws when canvas.toBlob returns empty so the caller can fall back', async () => {
    stubCanvasEncode({
      sourceWidth: 100,
      sourceHeight: 100,
      result: null,
    });

    await expect(
      encodePhotoBlobForWeb(new Blob(['src'], {type: 'image/jpeg'}), {
        maxWidth: MAX_IMAGE_WIDTH,
        quality: 0.6,
      })
    ).rejects.toThrow(/empty result/);
  });
});

// ---------------------------------------------------------------------------
// Field UI
// ---------------------------------------------------------------------------

describe('TakePhoto parallel save UI', () => {
  beforeEach(() => {
    vi.mocked(Camera.getPhoto).mockReset();
    vi.mocked(Camera.pickImages).mockReset();
    stubBrowserPhotoApis();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('holds the form lock from the open picker through the save', async () => {
    const user = userEvent.setup();
    const photo = deferred<{base64String: string; format: string}>();
    vi.mocked(Camera.getPhoto).mockReturnValue(photo.promise as never);
    const save = deferred<string>();
    let saves = 0;
    const setAttachmentSaving = vi.fn();

    renderTakePhoto({
      setAttachmentSaving,
      addAttachment: () => {
        saves += 1;
        return save.promise;
      },
    });

    await user.click(screen.getByRole('button', {name: 'Camera'}));

    await waitFor(() => {
      expect(setAttachmentSaving).toHaveBeenCalledWith(true);
    });
    expect(screen.getByRole('button', {name: 'Camera'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(
      screen.getByRole('button', {
        name: 'Add photos from gallery, multiple selection allowed',
      })
    ).toHaveAttribute('aria-disabled', 'true');

    photo.resolve({base64String: btoa('photo'), format: 'jpeg'});
    await waitFor(() => {
      expect(saves).toBe(1);
    });
    expect(setAttachmentSaving).not.toHaveBeenCalledWith(false);

    save.resolve('att-1');
    await waitFor(() => {
      expect(setAttachmentSaving).toHaveBeenCalledWith(false);
    });
    expect(screen.getByRole('button', {name: 'Camera'})).toHaveAttribute(
      'aria-disabled',
      'false'
    );
  });

  it('disables delete only while the picker is open', async () => {
    const user = userEvent.setup();
    const photo = deferred<{base64String: string; format: string}>();
    vi.mocked(Camera.getPhoto).mockReturnValue(photo.promise as never);
    const save = deferred<string>();
    const removeAttachment = vi.fn(async () => undefined);

    renderTakePhoto({
      withExistingPhoto: true,
      removeAttachment,
      addAttachment: () => save.promise,
    });

    const deleteButton = await screen.findByRole('button', {
      name: 'Delete photo',
    });
    expect(deleteButton).toBeEnabled();

    await user.click(screen.getByRole('button', {name: 'Camera'}));
    await waitFor(() => {
      expect(deleteButton).toBeDisabled();
    });

    await act(async () => {
      photo.resolve({base64String: btoa('photo'), format: 'jpeg'});
    });
    await waitFor(() => {
      expect(deleteButton).toBeEnabled();
    });

    await user.click(deleteButton);
    await user.click(screen.getByRole('button', {name: 'Delete'}));
    expect(removeAttachment).toHaveBeenCalledWith({
      attachmentId: 'att-existing',
    });

    save.resolve('att-new');
  });

  it('caps parallel gallery saves and disables capture at capacity', async () => {
    const user = userEvent.setup();
    const batch = MAX_PARALLEL_SAVES + 3;
    vi.mocked(Camera.pickImages).mockResolvedValue({
      photos: Array.from({length: batch}, (_, i) => ({
        webPath: `blob:photo-${i}`,
        format: 'jpeg',
      })),
    } as never);

    let inFlight = 0;
    let maxInFlight = 0;
    const releases: Array<(id: string) => void> = [];
    const addAttachment = vi.fn(
      () =>
        new Promise<string>(resolve => {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          releases.push(id => {
            inFlight -= 1;
            resolve(id);
          });
        })
    );

    renderTakePhoto({addAttachment});

    await user.click(
      screen.getByRole('button', {
        name: 'Add photos from gallery, multiple selection allowed',
      })
    );

    await waitFor(() => {
      expect(addAttachment).toHaveBeenCalledTimes(MAX_PARALLEL_SAVES);
    });
    expect(maxInFlight).toBe(MAX_PARALLEL_SAVES);
    expect(screen.getByRole('button', {name: 'Camera'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    const camera = screen.getByRole('button', {name: 'Camera'});
    await user.hover(camera.parentElement ?? camera);
    expect(
      await screen.findByText(
        `Up to ${MAX_PARALLEL_SAVES} photos can save at once — wait for one to finish.`
      )
    ).toBeInTheDocument();

    releases[0]?.('att-0');
    await waitFor(() => {
      expect(addAttachment).toHaveBeenCalledTimes(MAX_PARALLEL_SAVES + 1);
    });
    expect(maxInFlight).toBe(MAX_PARALLEL_SAVES);
    expect(screen.getByRole('button', {name: 'Camera'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    for (let i = 1; i < releases.length; i++) {
      releases[i]?.(`att-${i}`);
    }
    await waitFor(() => {
      expect(addAttachment).toHaveBeenCalledTimes(batch);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Camera'})).toHaveAttribute(
        'aria-disabled',
        'false'
      );
    });
    expect(maxInFlight).toBe(MAX_PARALLEL_SAVES);
  });
});

describe('TakePhoto handleDelete during parallel saves', () => {
  let releaseFirst: (id: string) => void;
  let releaseSecond: (id: string) => void;
  const addAttachment = vi.fn();
  const removeAttachment = vi.fn(async () => undefined);

  beforeEach(() => {
    addAttachment.mockReset();
    removeAttachment.mockClear();
    let calls = 0;
    addAttachment.mockImplementation(
      () =>
        new Promise<string>(resolve => {
          calls += 1;
          if (calls === 1) releaseFirst = resolve;
          else releaseSecond = resolve;
        })
    );
    vi.mocked(Camera.pickImages).mockResolvedValue({
      photos: [
        {webPath: 'blob:one', format: 'jpeg'},
        {webPath: 'blob:two', format: 'jpeg'},
      ],
    } as never);
    stubBrowserPhotoApis();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps attachment ids that finished saving while a delete was confirmed', async () => {
    const user = userEvent.setup();
    const store = {current: ['photo-a', 'photo-b']};
    const armDeleteOnAppend = {current: false};

    render(
      <DeleteRaceHarness
        store={store}
        armDeleteOnAppend={armDeleteOnAppend}
        addAttachment={addAttachment}
        removeAttachment={removeAttachment}
        onAppend={() => {
          screen.getByRole('button', {name: 'Delete'}).click();
        }}
      />
    );

    await screen.findAllByRole('button', {name: 'Delete photo'});

    await user.click(
      screen.getByRole('button', {
        name: 'Add photos from gallery, multiple selection allowed',
      })
    );

    await waitFor(() => {
      expect(addAttachment).toHaveBeenCalledTimes(2);
    });

    await user.click(screen.getAllByRole('button', {name: 'Delete photo'})[0]);
    armDeleteOnAppend.current = true;
    releaseFirst('new-1');
    releaseSecond('new-2');

    await waitFor(() => {
      expect(store.current).toEqual(['photo-b', 'new-1', 'new-2']);
    });
    expect(removeAttachment).toHaveBeenCalledWith({attachmentId: 'photo-a'});
  });
});
