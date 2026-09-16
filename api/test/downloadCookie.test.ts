import {describe, expect, it} from 'vitest';
import {parseCookieHeader} from '../src/downloadCookie';

describe('parseCookieHeader', () => {
  it('returns an empty object for a missing header', () => {
    expect(parseCookieHeader(undefined)).toEqual({});
  });

  it('returns an empty object for an empty header', () => {
    expect(parseCookieHeader('')).toEqual({});
  });

  it('parses a single name=value pair', () => {
    expect(parseCookieHeader('faims_download=grant.secret')).toEqual({
      faims_download: 'grant.secret',
    });
  });

  it('parses multiple cookies separated by semicolons', () => {
    expect(parseCookieHeader('a=1; b=2; c=3')).toEqual({
      a: '1',
      b: '2',
      c: '3',
    });
  });

  it('trims whitespace around names and values', () => {
    expect(parseCookieHeader('  a = 1 ;  b=2  ')).toEqual({
      a: '1',
      b: '2',
    });
  });

  it('skips segments that have no equals sign', () => {
    expect(parseCookieHeader('a=1; lone; b=2')).toEqual({
      a: '1',
      b: '2',
    });
  });

  it('skips segments with an empty name', () => {
    expect(parseCookieHeader('=novalue; a=1')).toEqual({a: '1'});
  });

  it('keeps equals signs inside the value', () => {
    expect(parseCookieHeader('token=abc=def=ghi')).toEqual({
      token: 'abc=def=ghi',
    });
  });

  it('URL-decodes values', () => {
    expect(parseCookieHeader('name=hello%20world')).toEqual({
      name: 'hello world',
    });
  });

  it('keeps the raw value when percent-decoding fails', () => {
    expect(parseCookieHeader('name=%ZZ')).toEqual({name: '%ZZ'});
  });

  it('keeps an empty value', () => {
    expect(parseCookieHeader('empty=')).toEqual({empty: ''});
  });

  it('last duplicate name wins', () => {
    expect(parseCookieHeader('a=first; a=second')).toEqual({a: 'second'});
  });

  it('parses the __Secure- download cookie name', () => {
    expect(parseCookieHeader('__Secure-faims_download=grantId.secret')).toEqual(
      {
        '__Secure-faims_download': 'grantId.secret',
      }
    );
  });
});
