import {describe, expect, it} from 'vitest';
import {
  contentDispositionAttachment,
  sanitizeDownloadFilename,
  simpleHash,
} from '../src/couchdb/export/utils';

describe('simpleHash', () => {
  it('returns deterministic results', () => {
    const result1 = simpleHash('hello123!?', 8);
    const result2 = simpleHash('hello123!?', 8);
    expect(result1).toBe(result2);
  });

  it('returns string of requested length', () => {
    expect(simpleHash('test', 4)).toHaveLength(4);
    expect(simpleHash('test', 6)).toHaveLength(6);
    expect(simpleHash('test', 8)).toHaveLength(8);
  });

  it('returns valid hex characters only', () => {
    const result = simpleHash('anything', 8);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it('produces different hashes for different inputs', () => {
    const a = simpleHash('file_a.txt', 8);
    const b = simpleHash('file_b.txt', 8);
    expect(a).not.toBe(b);
  });

  it('handles empty string input', () => {
    const result = simpleHash('', 8);
    expect(result).toHaveLength(8);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it('truncates when length is shorter than full hash', () => {
    const short = simpleHash('test', 4);
    const full = simpleHash('test', 8);
    expect(full.startsWith(short)).toBe(true);
  });

  it('pads with zeros when length exceeds 8 hex chars', () => {
    const result = simpleHash('test', 12);
    expect(result).toHaveLength(12);
    // Should have leading zeros since djb2 only produces 32-bit (8 hex chars)
    expect(result).toMatch(/^0+[0-9a-f]+$/);
  });

  it('handles long input strings', () => {
    const longStr = 'a'.repeat(10000);
    const result = simpleHash(longStr, 8);
    expect(result).toHaveLength(8);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it('is sensitive to small input changes', () => {
    const a = simpleHash('test1', 8);
    const b = simpleHash('test2', 8);
    expect(a).not.toBe(b);
  });
});

describe('sanitizeDownloadFilename', () => {
  it('slugifies ordinary form labels', () => {
    expect(sanitizeDownloadFilename('Site Survey')).toBe('site_survey');
  });

  it('strips quotes used to break Content-Disposition', () => {
    expect(sanitizeDownloadFilename('Form"; filename="evil.html')).toBe(
      'form_filenameevilhtml'
    );
  });

  it('strips CR/LF header-injection characters', () => {
    expect(sanitizeDownloadFilename('Form\r\nX-Injected: yes')).toBe(
      'form_x-injected_yes'
    );
  });

  it('falls back when the label is only unsafe characters', () => {
    expect(sanitizeDownloadFilename('"""')).toBe('export');
    expect(sanitizeDownloadFilename('"""', 'form')).toBe('form');
  });
});

describe('contentDispositionAttachment', () => {
  it('quotes a safe filename', () => {
    expect(contentDispositionAttachment('site_survey-export.csv')).toBe(
      'attachment; filename="site_survey-export.csv"'
    );
  });

  it('cannot be terminated by a double-quote in the form name', () => {
    const header = contentDispositionAttachment('Form"; filename="pwned.html');
    expect(header).toBe('attachment; filename="Form_filename_pwned.html"');
    expect(header).not.toContain('"pwned');
    expect(header.match(/filename="/g)).toHaveLength(1);
  });

  it('strips CR/LF so extra headers cannot be injected', () => {
    const header = contentDispositionAttachment('name\r\nSet-Cookie: a=b.csv');
    expect(header).not.toMatch(/[\r\n]/);
    expect(header).toBe('attachment; filename="name_Set-Cookie_a_b.csv"');
  });

  it('preserves a single extension after sanitising', () => {
    const header = contentDispositionAttachment('survey-export.csv');
    expect(header).toMatch(/\.csv"$/);
    expect(header).not.toMatch(/\.html/);
  });
});
