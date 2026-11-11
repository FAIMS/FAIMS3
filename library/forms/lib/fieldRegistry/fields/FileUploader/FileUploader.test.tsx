// SPDX-License-Identifier: Apache-2.0
/**
 * FileUploader tests.
 *
 * - Value schema: required, minimum and maximum attachment counts
 * - Field UI: maximum capacity, upload batches and form-saving lock
 * - File picker: open/cancel behaviour and per-selection limits
 *
 * react-dropzone is mocked so tests can trigger its callbacks directly.
 * Attachment loading is mocked so no database or network is required.
 */

import '@testing-library/jest-dom/vitest';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type ReactNode} from 'react';
import {z} from 'zod';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  FILE_UPLOADER_REQUIRED_MESSAGE,
  fileUploaderValueSchema,
  getFileUploaderMaximumMessage,
  getFileUploaderMinimumMessage,
} from './valueSchema';
import {
  DEFAULT_MAXIMUM_FILE_SIZE_BYTES,
  FileUploader,
  HARD_MAXIMUM_FILE_SIZE_BYTES,
  fileUploaderFieldSpec,
} from './index';

/** Capture react-dropzone's latest props without invoking the native file picker. */
const mockDropzone = vi.hoisted(() => ({
  props: null as null | {
    onDrop: (files: File[]) => void;
    onDropRejected: (
      rejections: {
        errors: {code: string; message: string}[];
      }[]
    ) => void;
    onFileDialogOpen?: () => void;
    onFileDialogCancel?: () => void;
    disabled: boolean;
    multiple: boolean;
    maxFiles: number;
    maxSize?: number;
    minSize?: number;
  },
}));

vi.mock('react-dropzone', () => ({
  default: (
    props: NonNullable<typeof mockDropzone.props> & {
      children: (args: {
        getRootProps: () => Record<string, unknown>;
        getInputProps: () => Record<string, unknown>;
        isDragActive: boolean;
      }) => ReactNode;
    }
  ) => {
    // This mock exercises FileUploader's handlers, not react-dropzone itself.
    mockDropzone.props = props;
    return props.children({
      getRootProps: () => ({'data-testid': 'file-dropzone'}),
      getInputProps: () => ({
        'data-testid': 'file-input',
        type: 'file',
        disabled: props.disabled,
        multiple: props.multiple,
      }),
      isDragActive: false,
    });
  },
}));

/**
 * Per-attachment content types for the mocked loader. Ids not listed here
 * load as `text/plain`.
 */
const mockAttachmentTypes = vi.hoisted(
  () => ({}) as Record<string, {contentType: string; filename: string}>
);

vi.mock('../../../hooks/useAttachment', () => ({
  useAttachments: (ids: string[]) =>
    ids.map(id => ({
      isLoading: false,
      isError: false,
      data: {
        id,
        url: `blob:${id}`,
        metadata: mockAttachmentTypes[id] ?? {
          filename: `${id}.txt`,
          contentType: 'text/plain',
        },
      },
    })),
}));

type Deferred<T> = {promise: Promise<T>; resolve: (value: T) => void};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return {promise, resolve};
}

function file(name: string): File {
  return new File(['file-content'], name, {type: 'text/plain'});
}

/** Call the uploader's handler as react-dropzone would after selection/drop. */
async function dropFiles(files: File[]) {
  expect(mockDropzone.props).not.toBeNull();
  await act(async () => {
    // Do not await the handler: its attachment saves may intentionally be pending.
    void mockDropzone.props!.onDrop(files);
  });
}

function renderUploader({
  initialIds = [],
  addAttachment = vi.fn(async () => 'new-file'),
  removeAttachment = vi.fn(async () => undefined),
  setAttachmentSaving = vi.fn(),
  required = false,
  minItems,
  maxItems,
  multiple = true,
  disabled = false,
  maximumFileSize,
}: {
  initialIds?: string[];
  addAttachment?: () => Promise<string>;
  removeAttachment?: (params: {attachmentId: string}) => Promise<void>;
  setAttachmentSaving?: (saving: boolean) => void;
  required?: boolean;
  minItems?: number | null;
  maxItems?: number | null;
  multiple?: boolean;
  disabled?: boolean;
  maximumFileSize?: number;
}) {
  const client = new QueryClient({
    defaultOptions: {queries: {retry: false}},
  });
  const store = {current: [...initialIds]};

  const Harness = () => {
    const [ids, setIds] = useState(initialIds);

    const setFieldData = (value: unknown) => {
      setIds(previous => {
        const updated =
          typeof value === 'function'
            ? (value as (prev: string[] | undefined) => string[])(previous)
            : (value as string[] | undefined);
        store.current = updated ?? [];
        return updated ?? [];
      });
    };

    return (
      <FileUploader
        fieldId="files"
        name="files"
        label="Files"
        helperText=""
        advancedHelperText=""
        required={required}
        disabled={disabled}
        minItems={minItems}
        maxItems={maxItems}
        multiple={multiple}
        maximum_file_size={maximumFileSize}
        state={
          {
            value: {
              data: ids,
              attachments: ids.map(attachmentId => ({
                attachmentId,
                filename: `${attachmentId}.txt`,
                fileType: 'text/plain',
              })),
            },
            meta: {errors: []},
          } as never
        }
        setFieldData={setFieldData}
        setFieldAnnotation={vi.fn()}
        addAttachment={addAttachment}
        removeAttachment={removeAttachment}
        setAttachmentSaving={setAttachmentSaving}
        handleBlur={vi.fn()}
        trigger={{commit: vi.fn(async () => undefined)}}
        config={
          {
            mode: 'full',
            attachmentEngine: () => ({loadAttachmentAsBlob: vi.fn()}),
          } as never
        }
      />
    );
  };

  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>
  );

  return {store, addAttachment, removeAttachment, setAttachmentSaving};
}

afterEach(() => {
  mockDropzone.props = null;
  for (const key of Object.keys(mockAttachmentTypes)) {
    delete mockAttachmentTypes[key];
  }
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Value schema
// ---------------------------------------------------------------------------

describe('fileUploaderValueSchema', () => {
  it('rejects an untouched required field with a human-readable error', () => {
    const schema = fileUploaderValueSchema({required: true});

    for (const value of [undefined, null, []]) {
      const result = schema.safeParse(value);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          FILE_UPLOADER_REQUIRED_MESSAGE
        );
      }
    }
  });

  it('accepts empty, absent and populated values when optional', () => {
    const schema = fileUploaderValueSchema({required: false});
    for (const value of [undefined, null, [], ['id-1']]) {
      expect(schema.safeParse(value).success).toBe(true);
    }
  });

  it('enforces minItems even when Required is false', () => {
    const schema = fileUploaderValueSchema({required: false, minItems: 2});

    for (const value of [undefined, null, [], ['id-1']]) {
      const result = schema.safeParse(value);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          getFileUploaderMinimumMessage(2)
        );
      }
    }
    expect(schema.safeParse(['id-1', 'id-2']).success).toBe(true);
  });

  it('enforces maxItems without requiring an attachment', () => {
    const schema = fileUploaderValueSchema({maxItems: 1});
    for (const value of [undefined, null, [], ['id-1']]) {
      expect(schema.safeParse(value).success).toBe(true);
    }

    const result = schema.safeParse(['id-1', 'id-2']);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        getFileUploaderMaximumMessage(1)
      );
    }
  });

  it('accepts counts within both bounds and rejects counts outside', () => {
    const schema = fileUploaderValueSchema({minItems: 2, maxItems: 3});
    expect(schema.safeParse(['a']).success).toBe(false);
    expect(schema.safeParse(['a', 'b']).success).toBe(true);
    expect(schema.safeParse(['a', 'b', 'c']).success).toBe(true);
    expect(schema.safeParse(['a', 'b', 'c', 'd']).success).toBe(false);
  });

  it('rejects invalid attachment ID types', () => {
    const schema = fileUploaderValueSchema({required: false});
    expect(schema.safeParse('id-1').success).toBe(false);
    expect(schema.safeParse([123]).success).toBe(false);
  });

  it('accepts legacy configurations without item-count limits', () => {
    const schema = fileUploaderValueSchema({required: false});
    expect(schema.safeParse(Array(12).fill('id')).success).toBe(true);

    const unrestricted = fileUploaderValueSchema({
      required: false,
      minItems: null,
      maxItems: null,
    });
    expect(unrestricted.safeParse([]).success).toBe(true);
  });

  it('validates a missing object key when minItems is configured', () => {
    const schema = z.object({files: fileUploaderValueSchema({minItems: 2})});
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['files']);
      expect(result.error.issues[0]?.message).toBe(
        getFileUploaderMinimumMessage(2)
      );
    }
  });

  it('is registered as the FileUploader field value schema', () => {
    expect(fileUploaderFieldSpec.fieldDataSchemaFunction).toBe(
      fileUploaderValueSchema
    );
  });

  it('formats singular and plural count messages', () => {
    expect(getFileUploaderMinimumMessage(1)).toBe(
      'At least one file is required'
    );
    expect(getFileUploaderMinimumMessage(2)).toBe(
      'At least 2 files are required'
    );
    expect(getFileUploaderMaximumMessage(1)).toBe('Maximum 1 file allowed');
    expect(getFileUploaderMaximumMessage(2)).toBe('Maximum 2 files allowed');
  });
});

// ---------------------------------------------------------------------------
// Field UI and upload capacity
// ---------------------------------------------------------------------------

describe('FileUploader upload UI', () => {
  it('keeps the dropzone visible but disabled at maxItems', () => {
    renderUploader({initialIds: ['existing'], maxItems: 1});

    expect(screen.getByTestId('file-input')).toBeDisabled();
    expect(mockDropzone.props?.disabled).toBe(true);
    expect(screen.getByText('Uploaded files (1/1)')).toBeInTheDocument();
    expect(
      screen.queryByText(/Remove extra files to meet the limit/)
    ).not.toBeInTheDocument();
  });

  it('re-enables upload after an attachment is deleted', async () => {
    const user = userEvent.setup();
    const removeAttachment = vi.fn(async () => undefined);
    const {store} = renderUploader({
      initialIds: ['existing'],
      maxItems: 1,
      removeAttachment,
    });

    expect(mockDropzone.props?.disabled).toBe(true);
    await user.click(screen.getByRole('button', {name: 'delete'}));

    await waitFor(() => {
      expect(store.current).toEqual([]);
      expect(mockDropzone.props?.disabled).toBe(false);
    });
    expect(removeAttachment).toHaveBeenCalledWith({attachmentId: 'existing'});
  });

  it('does not render the upload area when the field is disabled', () => {
    renderUploader({disabled: true, maxItems: 1, initialIds: ['existing']});
    expect(screen.queryByTestId('file-dropzone')).toBeNull();
  });

  it('rejects a batch that would exceed the remaining capacity', async () => {
    const addAttachment = vi.fn(async () => 'new-id');
    renderUploader({maxItems: 1, addAttachment});

    // Directly call onDrop to verify the defensive check in FileUploader.
    await dropFiles([file('first.txt'), file('second.txt')]);

    expect(addAttachment).not.toHaveBeenCalled();
    expect(screen.getByText(/You can add 1 more/)).toBeInTheDocument();
  });

  it('reserves slots immediately so overlapping batches cannot exceed maxItems', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const addAttachment = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const {store} = renderUploader({maxItems: 3, addAttachment});

    await dropFiles([file('a.txt'), file('b.txt')]);
    // The leading-byte content sniff runs before the first save.
    await waitFor(() => expect(addAttachment).toHaveBeenCalledTimes(1));
    // Pending uploads reserve capacity but are not counted as uploaded files.
    expect(screen.queryByText(/Uploaded files/)).not.toBeInTheDocument();

    // The two in-flight reservations leave room for only one more file.
    await dropFiles([file('c.txt'), file('d.txt')]);
    expect(addAttachment).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/You can add 1 more/)).toBeInTheDocument();

    await act(async () => {
      first.resolve('id-a');
    });
    await waitFor(() => expect(addAttachment).toHaveBeenCalledTimes(2));

    await act(async () => {
      second.resolve('id-b');
    });
    await waitFor(() => expect(store.current).toEqual(['id-a', 'id-b']));
    expect(screen.getByText('Uploaded files (2/3)')).toBeInTheDocument();
  });

  it('keeps the form locked until all overlapping batches finish', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const addAttachment = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const setAttachmentSaving = vi.fn();
    const {store} = renderUploader({
      maxItems: 2,
      addAttachment,
      setAttachmentSaving,
    });

    await dropFiles([file('a.txt')]);
    await dropFiles([file('b.txt')]);
    await waitFor(() => expect(addAttachment).toHaveBeenCalledTimes(2));
    expect(mockDropzone.props?.disabled).toBe(true);
    expect(setAttachmentSaving).toHaveBeenCalledWith(true);

    await act(async () => {
      first.resolve('id-a');
    });
    await waitFor(() => expect(store.current).toContain('id-a'));
    expect(setAttachmentSaving).not.toHaveBeenCalledWith(false);

    await act(async () => {
      second.resolve('id-b');
    });
    await waitFor(() => expect(store.current).toEqual(['id-a', 'id-b']));
    await waitFor(() =>
      expect(setAttachmentSaving).toHaveBeenLastCalledWith(false)
    );
  });

  it('does not treat multiple=false as a lifetime maxItems of one', async () => {
    let index = 0;
    const addAttachment = vi.fn(async () => `id-${++index}`);
    const {store} = renderUploader({multiple: false, addAttachment});

    expect(mockDropzone.props?.multiple).toBe(false);
    expect(mockDropzone.props?.maxFiles).toBe(1);

    await dropFiles([file('first.txt')]);
    await waitFor(() => expect(store.current).toEqual(['id-1']));
    await dropFiles([file('second.txt')]);
    await waitFor(() => expect(store.current).toEqual(['id-1', 'id-2']));
    expect(mockDropzone.props?.disabled).toBe(false);
  });

  it('holds the form lock while a picker is open and releases it on cancel', () => {
    const setAttachmentSaving = vi.fn();
    renderUploader({setAttachmentSaving});

    act(() => mockDropzone.props?.onFileDialogOpen?.());
    expect(setAttachmentSaving).toHaveBeenLastCalledWith(true);

    act(() => mockDropzone.props?.onFileDialogCancel?.());
    expect(setAttachmentSaving).toHaveBeenLastCalledWith(false);
  });

  it('keeps a picker lock until its selected file finishes saving', async () => {
    const pending = deferred<string>();
    const setAttachmentSaving = vi.fn();
    const {store} = renderUploader({
      addAttachment: () => pending.promise,
      setAttachmentSaving,
    });

    act(() => mockDropzone.props?.onFileDialogOpen?.());
    await dropFiles([file('selected.txt')]);
    expect(setAttachmentSaving).toHaveBeenCalledWith(true);
    expect(setAttachmentSaving).not.toHaveBeenCalledWith(false);

    await act(async () => {
      pending.resolve('picked-id');
    });
    await waitFor(() => expect(store.current).toEqual(['picked-id']));
    await waitFor(() =>
      expect(setAttachmentSaving).toHaveBeenLastCalledWith(false)
    );
  });

  it('shows a rejection message for files that are too large', () => {
    renderUploader({maximumFileSize: 1024});

    act(() => {
      mockDropzone.props?.onDropRejected([
        {errors: [{code: 'file-too-large', message: 'File is too large'}]},
      ]);
    });

    expect(screen.getByText(/File is too large/)).toBeInTheDocument();
  });

  it('releases reserved capacity and form lock after a failed upload', async () => {
    const addAttachment = vi.fn(async () => {
      throw new Error('Storage failed');
    });
    const setAttachmentSaving = vi.fn();
    renderUploader({maxItems: 1, addAttachment, setAttachmentSaving});

    await dropFiles([file('failure.txt')]);

    await waitFor(() => {
      expect(screen.getByText(/Failed to upload file/)).toBeInTheDocument();
    });
    expect(mockDropzone.props?.disabled).toBe(false);
    expect(setAttachmentSaving).toHaveBeenLastCalledWith(false);
  });

  it('clamps the configured per-file size to the hard maximum', () => {
    renderUploader({maximumFileSize: HARD_MAXIMUM_FILE_SIZE_BYTES * 2});
    expect(mockDropzone.props?.maxSize).toBe(HARD_MAXIMUM_FILE_SIZE_BYTES);
  });

  it('uses the default maximum size when none is configured', () => {
    renderUploader({});
    expect(mockDropzone.props?.maxSize).toBe(DEFAULT_MAXIMUM_FILE_SIZE_BYTES);
  });
});

// ---------------------------------------------------------------------------
// Upload rejection: SVG/HTML by type, extension or leading bytes
// ---------------------------------------------------------------------------

const SCRIPT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const GPX =
  '<?xml version="1.0"?><gpx version="1.1"><wpt lat="0" lon="0"/></gpx>';

describe('FileUploader blocked uploads', () => {
  const blocked: [string, File][] = [
    ['evil.svg', new File([SCRIPT_SVG], 'evil.svg', {type: 'image/svg+xml'})],
    [
      'evil.html',
      new File(['<!doctype html><script>alert(1)</script>'], 'evil.html', {
        type: 'text/html',
      }),
    ],
    [
      'page.htm',
      new File(['<html></html>'], 'page.htm', {
        type: 'application/octet-stream',
      }),
    ],
    // Mislabelled: SVG bytes behind a PNG name and type (caught by sniff).
    ['photo.png', new File([SCRIPT_SVG], 'photo.png', {type: 'image/png'})],
    // Upper-case extension, empty type.
    ['PHOTO.SVG', new File([SCRIPT_SVG], 'PHOTO.SVG', {type: ''})],
    // SVG bytes behind a text name/type.
    ['notes.txt', new File([SCRIPT_SVG], 'notes.txt', {type: 'text/plain'})],
  ];

  it.each(blocked)(
    'rejects %s, releases the lock and stays usable',
    async (name, evil) => {
      const addAttachment = vi.fn(async () => 'new-id');
      const setAttachmentSaving = vi.fn();
      const {store} = renderUploader({
        maxItems: 1,
        addAttachment,
        setAttachmentSaving,
      });

      act(() => mockDropzone.props?.onFileDialogOpen?.());
      await dropFiles([evil]);

      await waitFor(() => {
        expect(
          screen.getByText(`"${name}": SVG and HTML files cannot be uploaded.`)
        ).toBeInTheDocument();
      });
      expect(addAttachment).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(setAttachmentSaving).toHaveBeenLastCalledWith(false)
      );
      // Nothing reserved: dropzone is still enabled at maxItems=1.
      expect(mockDropzone.props?.disabled).toBe(false);

      // A subsequent valid drop succeeds (no leaked reservation/active count).
      await dropFiles([file('good.txt')]);
      await waitFor(() => expect(addAttachment).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(store.current).toEqual(['new-id']));
      expect(
        screen.queryByText(/SVG and HTML files cannot be uploaded/)
      ).toBeNull();
    }
  );

  it('rejects the whole batch when one file is blocked', async () => {
    const addAttachment = vi.fn(async () => 'new-id');
    const setAttachmentSaving = vi.fn();
    const {store} = renderUploader({addAttachment, setAttachmentSaving});

    await dropFiles([
      file('good.txt'),
      new File([SCRIPT_SVG], 'evil.svg', {type: 'image/svg+xml'}),
    ]);

    expect(
      screen.getByText('"evil.svg": SVG and HTML files cannot be uploaded.')
    ).toBeInTheDocument();
    expect(addAttachment).not.toHaveBeenCalled();
    expect(store.current).toEqual([]);
    expect(setAttachmentSaving).not.toHaveBeenCalledWith(true);
  });

  it('rejects the whole batch when a later file fails the byte sniff', async () => {
    const addAttachment = vi.fn(async () => 'new-id');
    const setAttachmentSaving = vi.fn();
    const {store} = renderUploader({addAttachment, setAttachmentSaving});

    await dropFiles([
      file('good.txt'),
      new File([SCRIPT_SVG], 'photo.png', {type: 'image/png'}),
    ]);

    await waitFor(() => {
      expect(
        screen.getByText('"photo.png": SVG and HTML files cannot be uploaded.')
      ).toBeInTheDocument();
    });
    expect(addAttachment).not.toHaveBeenCalled();
    expect(store.current).toEqual([]);
    await waitFor(() =>
      expect(setAttachmentSaving).toHaveBeenLastCalledWith(false)
    );
  });

  it('accepts benign controls', async () => {
    let n = 0;
    const addAttachment = vi.fn(async () => `id-${++n}`);
    const {store} = renderUploader({addAttachment});

    const good = [
      new File([JPEG_BYTES], 'photo.jpg', {type: 'image/jpeg'}),
      new File([PNG_BYTES], 'photo.png', {type: 'image/png'}),
      new File(['%PDF-1.4'], 'report.pdf', {type: 'application/pdf'}),
      new File(['notes'], 'notes.txt', {type: 'text/plain'}),
      new File([GPX], 'track.gpx', {type: ''}),
    ];
    await dropFiles(good);

    await waitFor(() => expect(addAttachment).toHaveBeenCalledTimes(5));
    await waitFor(() => expect(store.current).toHaveLength(5));
    expect(
      screen.queryByText(/SVG and HTML files cannot be uploaded/)
    ).toBeNull();
    expect(addAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'application/octet-stream',
        fileFormat: 'gpx',
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Attachment display: SVG/HTML must never be rendered as an image
// ---------------------------------------------------------------------------

describe('FileUploader attachment display', () => {
  /**
   * Every element that could load or execute attachment bytes. (MUI icons are
   * inline <svg>s, so the check is on nodes that reference the blob URL plus
   * any embedding element at all.)
   */
  function activeContentNodes(url: string) {
    return [
      ...document.querySelectorAll(`[src="${url}"], [data="${url}"]`),
      ...document.querySelectorAll('object, embed, iframe'),
    ];
  }

  it('renders a stored SVG attachment as a generic file with no <img>', async () => {
    const user = userEvent.setup();
    mockAttachmentTypes['evil'] = {
      filename: 'evil.svg',
      contentType: 'image/svg+xml',
    };
    renderUploader({initialIds: ['evil']});

    expect(screen.getByText('evil.svg')).toBeInTheDocument();
    expect(screen.getByText('image/svg+xml')).toBeInTheDocument();
    expect(activeContentNodes('blob:evil')).toHaveLength(0);
    expect(document.querySelector('img')).toBeNull();

    await user.click(screen.getByText('evil.svg'));
    expect(
      await screen.findByText('File preview not available')
    ).toBeInTheDocument();
    // Opening the dialog must not render the blob either.
    expect(activeContentNodes('blob:evil')).toHaveLength(0);
    expect(document.querySelector('img')).toBeNull();
  });

  it.each([
    'Image/SVG+XML',
    'image/svg+xml;charset=utf-8',
    'text/html',
    'application/xhtml+xml',
  ])('treats %s as a non-image attachment', contentType => {
    mockAttachmentTypes['odd'] = {filename: 'odd.bin', contentType};
    renderUploader({initialIds: ['odd']});

    expect(screen.getByText('odd.bin')).toBeInTheDocument();
    expect(activeContentNodes('blob:odd')).toHaveLength(0);
    expect(document.querySelector('img')).toBeNull();
  });

  it('still renders a JPEG thumbnail and the image dialog', async () => {
    const user = userEvent.setup();
    mockAttachmentTypes['pic'] = {
      filename: 'pic.jpg',
      contentType: 'image/jpeg',
    };
    renderUploader({initialIds: ['pic']});

    const thumbnail = document.querySelector('img[src="blob:pic"]');
    expect(thumbnail).not.toBeNull();

    await user.click(thumbnail as Element);
    await waitFor(() => {
      expect(document.querySelectorAll('img[src="blob:pic"]')).toHaveLength(2);
    });
    expect(screen.queryByText('File preview not available')).toBeNull();
  });

  it('swaps a raster thumbnail that fails to decode for a placeholder', () => {
    mockAttachmentTypes['spoof'] = {
      filename: 'spoof.png',
      contentType: 'image/png',
    };
    renderUploader({initialIds: ['spoof']});

    const thumbnail = document.querySelector('img[src="blob:spoof"]');
    expect(thumbnail).not.toBeNull();
    fireEvent.error(thumbnail as HTMLImageElement);

    expect(screen.getByTestId('broken-image-thumbnail')).toBeInTheDocument();
    expect(document.querySelector('img[src="blob:spoof"]')).toBeNull();
  });
});
