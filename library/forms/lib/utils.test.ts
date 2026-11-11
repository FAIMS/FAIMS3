// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it, vi} from 'vitest';
import {FaimsForm} from './formModule/types';
import {
  ACTIVE_CONTENT_SNIFF_BYTES,
  BLOCKED_ATTACHMENT_CONTENT_TYPES,
  IMAGE_TYPES,
  blockedAttachmentMessage,
  fileHasActiveContent,
  hasBlockedAttachmentMetadata,
  isActiveContentBytes,
  isBlockedAttachmentContentType,
  isBlockedAttachmentFile,
  isBlockedAttachmentFilename,
  isBlockedAttachmentFormat,
  isBlockedAttachmentSource,
  isDisplayableImageType,
  normaliseContentType,
  writeFieldUpdates,
} from './utils';

type FormEntry = {data: unknown; annotation?: object};

/** A tanstack form stand-in exposing just the state and setter used here. */
const makeForm = (values: Record<string, FormEntry>) => {
  const setCalls: {field: string; value: unknown; runListeners: boolean}[] = [];
  const form = {
    state: {values},
    setFieldValue: (
      field: string,
      value: FormEntry,
      options?: {dontRunListeners?: boolean}
    ) => {
      values[field] = value;
      setCalls.push({
        field,
        value,
        runListeners: options?.dontRunListeners !== true,
      });
    },
  } as unknown as FaimsForm;
  return {form, values, setCalls};
};

describe('writeFieldUpdates', () => {
  it('writes each update into form state', () => {
    const {form, values} = makeForm({code: {data: 'OLD'}, id: {data: ''}});

    writeFieldUpdates({
      form,
      updates: {code: 'NEW', id: 'A1-NEW'},
      runListeners: false,
    });

    expect(values.code.data).toBe('NEW');
    expect(values.id.data).toBe('A1-NEW');
  });

  it('keeps the entry it overwrites, so an annotation survives', () => {
    const {form, values} = makeForm({
      code: {data: 'OLD', annotation: {annotation: 'checked'}},
    });

    writeFieldUpdates({form, updates: {code: 'NEW'}, runListeners: false});

    expect(values.code).toEqual({
      data: 'NEW',
      annotation: {annotation: 'checked'},
    });
  });

  it('clears a field with null, as a computed field does', () => {
    const {form, values} = makeForm({
      code: {data: 'OLD', annotation: {annotation: 'checked'}},
    });

    writeFieldUpdates({form, updates: {code: null}, runListeners: false});

    expect(values.code).toEqual({
      data: null,
      annotation: {annotation: 'checked'},
    });
  });

  it('adds a field form state does not hold yet', () => {
    const {form, values} = makeForm({});

    writeFieldUpdates({form, updates: {code: 'NEW'}, runListeners: false});

    expect(values.code).toEqual({data: 'NEW'});
  });

  it('passes the listener choice through, both ways', () => {
    const quiet = makeForm({code: {data: ''}});
    writeFieldUpdates({
      form: quiet.form,
      updates: {code: 'NEW'},
      runListeners: false,
    });
    expect(quiet.setCalls[0].runListeners).toBe(false);

    const loud = makeForm({code: {data: ''}});
    writeFieldUpdates({
      form: loud.form,
      updates: {code: 'NEW'},
      runListeners: true,
    });
    expect(loud.setCalls[0].runListeners).toBe(true);
  });

  it('touches nothing when there are no updates', () => {
    const {form, setCalls} = makeForm({code: {data: 'OLD'}});

    writeFieldUpdates({form, updates: {}, runListeners: false});

    expect(setCalls).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Attachment display classification (stored XSS via SVG mitigation)
// ---------------------------------------------------------------------------

describe('normaliseContentType', () => {
  it('lower-cases, trims and strips parameters', () => {
    expect(normaliseContentType('Image/JPEG')).toBe('image/jpeg');
    expect(normaliseContentType('  image/png  ')).toBe('image/png');
    expect(normaliseContentType('image/svg+xml;charset=utf-8')).toBe(
      'image/svg+xml'
    );
    expect(normaliseContentType('text/html; charset=UTF-8')).toBe('text/html');
  });

  it('turns non-string input into the empty string', () => {
    expect(normaliseContentType(undefined)).toBe('');
    expect(normaliseContentType(null)).toBe('');
    expect(normaliseContentType('')).toBe('');
  });
});

describe('isDisplayableImageType', () => {
  it('does not list SVG as a displayable image type', () => {
    expect(IMAGE_TYPES).not.toContain('image/svg+xml');
    expect(IMAGE_TYPES.some(t => t.includes('svg'))).toBe(false);
  });

  it.each([
    'image/svg+xml',
    'Image/SVG+XML',
    'image/svg+xml;charset=utf-8',
    ' image/svg+xml ',
    'image/svg',
    'text/html',
    'application/xhtml+xml',
    'application/octet-stream',
    'application/pdf',
    '',
    undefined,
    null,
  ])('is false for %j', contentType => {
    expect(isDisplayableImageType(contentType)).toBe(false);
  });

  it.each([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'IMAGE/JPEG',
    'image/png; charset=binary',
    '  image/webp',
  ])('is true for %j', contentType => {
    expect(isDisplayableImageType(contentType)).toBe(true);
  });

  it('fails closed for image/ prefixed types outside the allowlist', () => {
    expect(isDisplayableImageType('image/x-icon')).toBe(false);
    expect(isDisplayableImageType('image/tiff')).toBe(false);
    expect(isDisplayableImageType('image/')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Upload blocking: declared type, extension, leading-byte sniff
// ---------------------------------------------------------------------------

const enc = (s: string) => new TextEncoder().encode(s);

/** Test payload fixtures (see brief §6.1). */
const FIXTURES = {
  scriptSvg:
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
  onloadSvg:
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="1" height="1"/></svg>',
  foreignObjectSvg:
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject></svg>',
  pageHtml: '<!doctype html><script>alert(1)</script>',
  gpx: '<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="test"><wpt lat="0" lon="0"/></gpx>',
  kml: '<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Placemark/></kml>',
  text: 'Just some field notes.\nNothing to see here.',
  jpeg: new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
  ]),
  png: new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d,
  ]),
  pdf: '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj',
};

describe('isBlockedAttachmentContentType', () => {
  it.each([
    'image/svg+xml',
    'IMAGE/SVG+XML',
    'image/svg+xml;charset=utf-8',
    ' image/svg ',
    'text/html',
    'text/html; charset=utf-8',
    'application/xhtml+xml',
    'application/x-html',
    'text/xhtml',
  ])('blocks %j', t => {
    expect(isBlockedAttachmentContentType(t)).toBe(true);
  });

  it.each([
    'image/jpeg',
    'image/png',
    'audio/webm',
    'audio/mp4',
    'application/pdf',
    'application/octet-stream',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/gpx+xml',
    'application/xml',
    '',
    undefined,
    null,
  ])('allows %j', t => {
    expect(isBlockedAttachmentContentType(t)).toBe(false);
  });

  it('lists the same types as the CouchDB validator (manual sync guard)', () => {
    // If this changes, update permissionsDocument in
    // library/data-model/src/data_storage/dataDB/design.ts too.
    expect([...BLOCKED_ATTACHMENT_CONTENT_TYPES].sort()).toEqual(
      [
        'application/x-html',
        'application/xhtml+xml',
        'image/svg',
        'image/svg+xml',
        'text/html',
        'text/xhtml',
      ].sort()
    );
  });
});

describe('isBlockedAttachmentFilename', () => {
  it.each([
    'evil.svg',
    'PHOTO.SVG',
    'archive.svgz',
    'page.html',
    'page.HTM',
    'doc.xhtml',
    'index.shtml',
    'tricky.jpg.svg',
  ])('blocks %s', name => {
    expect(isBlockedAttachmentFilename(name)).toBe(true);
  });

  it.each([
    'photo.jpg',
    'photo.svg.jpg',
    'notes.txt',
    'track.gpx',
    'report.pdf',
    'svg',
    'html',
    'no-extension',
    'trailing.',
    '',
    undefined,
  ])('allows %j', name => {
    expect(isBlockedAttachmentFilename(name)).toBe(false);
  });
});

describe('isActiveContentBytes', () => {
  it.each([
    ['script.svg', FIXTURES.scriptSvg],
    ['onload.svg', FIXTURES.onloadSvg],
    ['foreignObject.svg', FIXTURES.foreignObjectSvg],
    ['page.html', FIXTURES.pageHtml],
    ['BOM-prefixed svg', '\uFEFF' + FIXTURES.scriptSvg],
    ['leading whitespace svg', '  \n\t ' + FIXTURES.scriptSvg],
    ['xml prolog then svg', '<?xml version="1.0"?>\n' + FIXTURES.scriptSvg],
    [
      'svg doctype',
      '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' +
        FIXTURES.scriptSvg,
    ],
    ['upper-case HTML', '<HTML><BODY><SCRIPT>alert(1)</SCRIPT></BODY></HTML>'],
    ['upper-case doctype html', '<!DOCTYPE HTML><html><script>1</script>'],
    ['html doctype then html', '<!doctype html>\n<html lang="en"></html>'],
    ['leading comment then svg', '<!-- hi --> <svg onload="alert(1)"/>'],
    ['xml prolog, comment, svg', '<?xml version="1.0"?><!-- c --><svg/>'],
  ])('detects %s', (_label, text) => {
    expect(isActiveContentBytes(enc(text))).toBe(true);
  });

  it.each([
    ['JPEG magic', FIXTURES.jpeg],
    ['PNG magic', FIXTURES.png],
    ['PDF header', enc(FIXTURES.pdf)],
    ['plain text', enc(FIXTURES.text)],
    ['GPX (xml prolog, no svg)', enc(FIXTURES.gpx)],
    ['KML (xml prolog, no svg)', enc(FIXTURES.kml)],
    ['bare xml prolog', enc('<?xml version="1.0"?>')],
    ['generic xml doctype', enc('<!DOCTYPE note SYSTEM "note.dtd"><note/>')],
    ['empty', new Uint8Array(0)],
    ['whitespace only', enc('   \n  ')],
    ['text mentioning svg', enc('I exported this as <svg> yesterday')],
    ['unterminated comment', enc('<!-- never closed <svg')],
  ])('does not flag %s', (_label, bytes) => {
    expect(isActiveContentBytes(bytes)).toBe(false);
  });

  it('only inspects the first 512 bytes (documented limit)', () => {
    // Padding is plain text so the sample window contains no markup at all;
    // the <svg> root begins only after byte 512. This is the accepted limit
    // of the sniff; the rendering strip and CouchDB validator cover the rest.
    const padding = 'x'.repeat(ACTIVE_CONTENT_SNIFF_BYTES);
    const late = enc(padding + FIXTURES.scriptSvg);
    expect(late.length).toBeGreaterThan(ACTIVE_CONTENT_SNIFF_BYTES);
    expect(isActiveContentBytes(late)).toBe(false);

    // ...whereas an <svg> that starts inside the window is caught, even if
    // the rest of the document lies beyond it.
    const inWindow = enc(
      '<?xml version="1.0"?>' +
        ' '.repeat(ACTIVE_CONTENT_SNIFF_BYTES - 40) +
        FIXTURES.scriptSvg
    );
    expect(isActiveContentBytes(inWindow)).toBe(true);
  });
});

describe('hasBlockedAttachmentMetadata / isBlockedAttachmentFormat', () => {
  it('blocks by declared type or extension', () => {
    expect(
      hasBlockedAttachmentMetadata({type: 'image/svg+xml', name: 'x.bin'})
    ).toBe(true);
    expect(hasBlockedAttachmentMetadata({type: '', name: 'PHOTO.SVG'})).toBe(
      true
    );
    expect(
      hasBlockedAttachmentMetadata({type: 'image/png', name: 'photo.png'})
    ).toBe(false);
  });

  it.each(['svg', 'svg+xml', 'SVG', 'image/svg+xml', 'html', 'xhtml'])(
    'blocks format %j',
    format => {
      expect(isBlockedAttachmentFormat(format)).toBe(true);
    }
  );

  it.each(['jpeg', 'png', 'gif', 'webp', 'heic', '', undefined])(
    'allows format %j',
    format => {
      expect(isBlockedAttachmentFormat(format)).toBe(false);
    }
  );
});

describe('fileHasActiveContent / isBlockedAttachmentFile', () => {
  it('reads only the leading slice of a File', async () => {
    const file = new File([FIXTURES.scriptSvg], 'photo.png', {
      type: 'image/png',
    });
    const slice = vi.spyOn(file, 'slice');
    await expect(fileHasActiveContent(file)).resolves.toBe(true);
    expect(slice).toHaveBeenCalledTimes(1);
    expect(slice).toHaveBeenCalledWith(0, ACTIVE_CONTENT_SNIFF_BYTES);
  });

  it('blocks by type, by extension, or by bytes', async () => {
    const byType = new File(['abc'], 'thing.bin', {type: 'image/svg+xml'});
    const byExt = new File(['abc'], 'PHOTO.SVG', {type: ''});
    const byBytes = new File([FIXTURES.scriptSvg], 'notes.txt', {
      type: 'text/plain',
    });
    await expect(isBlockedAttachmentFile(byType)).resolves.toBe(true);
    await expect(isBlockedAttachmentFile(byExt)).resolves.toBe(true);
    await expect(isBlockedAttachmentFile(byBytes)).resolves.toBe(true);
  });

  it('passes benign controls', async () => {
    const files = [
      new File([FIXTURES.jpeg], 'photo.jpg', {type: 'image/jpeg'}),
      new File([FIXTURES.png], 'photo.png', {type: 'image/png'}),
      new File([FIXTURES.pdf], 'report.pdf', {type: 'application/pdf'}),
      new File([FIXTURES.text], 'notes.txt', {type: 'text/plain'}),
      new File([FIXTURES.gpx], 'track.gpx', {type: 'application/gpx+xml'}),
      new File([FIXTURES.gpx], 'track.gpx', {type: ''}),
    ];
    for (const f of files) {
      await expect(isBlockedAttachmentFile(f)).resolves.toBe(false);
    }
  });

  it('names the offending file in the user message', () => {
    expect(blockedAttachmentMessage('evil.svg')).toBe(
      '"evil.svg": SVG and HTML files cannot be uploaded.'
    );
  });
});

describe('isBlockedAttachmentSource', () => {
  it('blocks SVG bytes behind a PNG type (TakePhoto spoofed extension)', async () => {
    const blob = new Blob([FIXTURES.scriptSvg], {type: 'image/png'});
    await expect(
      isBlockedAttachmentSource({blob, filename: 'photo.png', format: 'png'})
    ).resolves.toBe(true);
  });

  it('blocks by Capacitor format even when the blob type is jpeg', async () => {
    // Capacitor's web plugin reports SVG as format `jpeg` for getPhoto, but
    // pickImages format can be the real subtype when we supply it.
    const blob = new Blob(['not markup'], {type: 'image/jpeg'});
    await expect(
      isBlockedAttachmentSource({blob, format: 'svg+xml'})
    ).resolves.toBe(true);
  });

  it('allows a JPEG photo', async () => {
    const blob = new Blob([FIXTURES.jpeg], {type: 'image/jpeg'});
    await expect(
      isBlockedAttachmentSource({
        blob,
        filename: 'photo.jpeg',
        format: 'jpeg',
      })
    ).resolves.toBe(false);
  });
});
