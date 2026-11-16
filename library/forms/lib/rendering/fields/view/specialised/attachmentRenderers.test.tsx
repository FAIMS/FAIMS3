// SPDX-License-Identifier: Apache-2.0
/**
 * View renderer tests for attachment fields (FileUploaderRender,
 * TakePhotoRender).
 *
 * Covers the stored-XSS-via-SVG mitigation: an attachment whose stored
 * content type is SVG/HTML must render as a generic file card (or be
 * excluded from the photo gallery) and must never produce an <img>, <object>,
 * <embed> or <iframe> that references its blob URL. Safe raster types keep
 * rendering as before.
 */
import '@testing-library/jest-dom/vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {DataViewFieldRenderProps} from '../../../types';
import {FileUploaderRender} from './FileUploader';
import {TakePhotoRender} from './TakePhoto';

type MockAttachment = {filename: string; contentType: string};

/** Attachment metadata by id for the mocked loader. */
const mockAttachments = vi.hoisted(
  () => ({}) as Record<string, MockAttachment>
);

vi.mock('../../../../hooks/useAttachment', () => ({
  useAttachments: (ids: string[]) =>
    ids.map(id => {
      const meta = mockAttachments[id];
      if (!meta) return {isLoading: false, isError: true, data: undefined};
      return {
        isLoading: false,
        isError: false,
        data: {
          id,
          url: `blob:${id}`,
          blob: new Blob(['x'], {type: meta.contentType}),
          metadata: meta,
        },
      };
    }),
}));

vi.mock('../../../../components/PhotoLightbox', () => ({
  PhotoLightbox: ({url}: {url: string}) => (
    <div data-testid="lightbox" data-url={url} />
  ),
}));

/** Blob-URL references plus any embedding element at all. */
function activeContentNodes(url: string) {
  return [
    ...document.querySelectorAll(`[src="${url}"], [data="${url}"]`),
    ...document.querySelectorAll('object, embed, iframe'),
  ];
}

function renderProps(ids: string[]): DataViewFieldRenderProps {
  return {
    value: ids,
    attachments: ids.map(attachmentId => ({
      attachmentId,
      filename: mockAttachments[attachmentId]?.filename ?? attachmentId,
      fileType: mockAttachments[attachmentId]?.contentType ?? '',
    })),
    config: {},
    renderContext: {
      tools: {getAttachmentService: () => ({})},
    },
  } as never;
}

const SCRIPT_SVG: MockAttachment = {
  filename: 'script.svg',
  contentType: 'image/svg+xml',
};

afterEach(() => {
  for (const key of Object.keys(mockAttachments)) delete mockAttachments[key];
});

describe('FileUploaderRender', () => {
  it('renders an SVG-typed attachment as a file card with no <img>', () => {
    mockAttachments['svg'] = SCRIPT_SVG;
    render(<FileUploaderRender {...renderProps(['svg'])} />);

    expect(screen.getByText('script.svg')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    expect(activeContentNodes('blob:svg')).toHaveLength(0);
  });

  it.each([
    'Image/SVG+XML',
    'image/svg+xml; charset=utf-8',
    'text/html',
    'application/xhtml+xml',
  ])('renders %s as a file card', contentType => {
    mockAttachments['odd'] = {filename: 'odd.file', contentType};
    render(<FileUploaderRender {...renderProps(['odd'])} />);

    expect(screen.getByText('odd.file')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    expect(activeContentNodes('blob:odd')).toHaveLength(0);
  });

  it('renders a PNG-typed attachment as an <img> thumbnail', () => {
    mockAttachments['png'] = {filename: 'photo.png', contentType: 'image/png'};
    render(<FileUploaderRender {...renderProps(['png'])} />);

    const img = document.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', 'blob:png');
  });

  it('keeps raster thumbnails while isolating an SVG in the same field', () => {
    mockAttachments['png'] = {filename: 'photo.png', contentType: 'image/png'};
    mockAttachments['svg'] = SCRIPT_SVG;
    render(<FileUploaderRender {...renderProps(['png', 'svg'])} />);

    const imgs = document.querySelectorAll('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toHaveAttribute('src', 'blob:png');
    expect(screen.getByText('script.svg')).toBeInTheDocument();
    expect(activeContentNodes('blob:svg')).toHaveLength(0);
  });
});

describe('TakePhotoRender', () => {
  it('excludes an SVG-typed attachment from the gallery', () => {
    mockAttachments['svg'] = SCRIPT_SVG;
    render(<TakePhotoRender {...renderProps(['svg'])} />);

    expect(screen.getByText('No images to display')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    expect(activeContentNodes('blob:svg')).toHaveLength(0);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows JPEG photos and opens the lightbox only for them', async () => {
    const user = userEvent.setup();
    mockAttachments['jpg'] = {
      filename: 'photo.jpeg',
      contentType: 'image/jpeg',
    };
    mockAttachments['svg'] = SCRIPT_SVG;
    render(<TakePhotoRender {...renderProps(['jpg', 'svg'])} />);

    const imgs = document.querySelectorAll('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toHaveAttribute('src', 'blob:jpg');
    expect(activeContentNodes('blob:svg')).toHaveLength(0);

    // Only one clickable photo exists; it opens the lightbox on the JPEG URL.
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await user.click(screen.getByRole('button'));
    expect(screen.getByTestId('lightbox')).toHaveAttribute(
      'data-url',
      'blob:jpg'
    );
  });

  it('shows a broken-image thumbnail when a raster attachment fails to decode', () => {
    mockAttachments['png'] = {
      filename: 'spoof.png',
      contentType: 'image/png',
    };
    render(<TakePhotoRender {...renderProps(['png'])} />);

    const img = document.querySelector('img');
    expect(img).not.toBeNull();
    fireEvent.error(img as HTMLImageElement);

    expect(screen.getByTestId('broken-image-thumbnail')).toBeInTheDocument();
    expect(screen.getByText('Image preview not available')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
