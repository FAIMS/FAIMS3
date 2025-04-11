import {expect} from 'chai';
import {validateRedirect} from '../src/auth/helpers';
import {CONDUCTOR_PUBLIC_URL} from '../src/buildconfig';

describe('validateRedirect tests', () => {
  // Define a test whitelist that we'll use throughout the tests
  const testWhitelist = [
    'http://example.com',
    'https://trusted.domain.org',
    'http://localhost:3000',
    CONDUCTOR_PUBLIC_URL,
  ];

  it('should not accept relative URLs', () => {
    const result = validateRedirect('/dashboard', testWhitelist);
    expect(result).to.equal('/');
  });

  it('should not accept relative URLs with query parameters', () => {
    const result = validateRedirect(
      '/dashboard?user=123&action=view',
      testWhitelist
    );
    expect(result).to.equal('/');
  });

  it('should not accept relative URLs with hash fragments', () => {
    const result = validateRedirect('/dashboard#section1', testWhitelist);
    expect(result).to.equal('/');
  });

  it('should accept URLs from the whitelist', () => {
    const result = validateRedirect('http://example.com/path', testWhitelist);
    expect(result).to.equal('http://example.com/path');
  });

  it('should accept URLs from the whitelist with query parameters', () => {
    const result = validateRedirect(
      'http://example.com/path?param=value',
      testWhitelist
    );
    expect(result).to.equal('http://example.com/path?param=value');
  });

  it('should accept URLs from the whitelist with hash fragments', () => {
    const result = validateRedirect(
      'http://example.com/path#section',
      testWhitelist
    );
    expect(result).to.equal('http://example.com/path#section');
  });

  it('should reject URLs not in the whitelist', () => {
    const result = validateRedirect(
      'http://malicious.com/phishing',
      testWhitelist
    );
    expect(result).to.equal('/');
  });

  it('should reject URLs not in the whitelist that have same domain but different protocol', () => {
    const result = validateRedirect('https://example.com', testWhitelist);
    expect(result).to.equal('/');
  });

  it('should reject URLs not in the whitelist that have same domain but different port', () => {
    const result = validateRedirect('http://localhost:2525', testWhitelist);
    expect(result).to.equal('/');
  });

  it('should reject URLs with malicious subdomains', () => {
    // Make sure we're matching full origins, not just checking if a domain contains a whitelisted domain
    const result = validateRedirect('http://evil-example.com', testWhitelist);
    expect(result).to.equal('/');
  });

  it('should reject URLs with subdomains of trusted domains', () => {
    const result = validateRedirect(
      'http://subdomain.example.com',
      testWhitelist
    );
    expect(result).to.equal('/');
  });

  it('should reject unparseable URLs', () => {
    const result = validateRedirect('not-a-valid-url', testWhitelist);
    expect(result).to.equal('/');
  });

  it('should reject malformed URLs with javascript: protocol', () => {
    const result = validateRedirect(
      'javascript:alert(document.cookie)',
      testWhitelist
    );
    expect(result).to.equal('/');
  });

  it('should reject malformed URLs with data: protocol', () => {
    const result = validateRedirect(
      'data:text/html,<script>alert(document.cookie)</script>',
      testWhitelist
    );
    expect(result).to.equal('/');
  });

  it('should handle empty whitelist by rejecting all absolute URLs', () => {
    const result = validateRedirect('http://example.com', []);
    expect(result).to.equal('/');
  });

  it('should handle empty redirect URLs', () => {
    const result = validateRedirect('', testWhitelist);
    expect(result).to.equal('/');
  });

  it('should handle undefined redirect URLs', () => {
    const result = validateRedirect(
      undefined as unknown as string,
      testWhitelist
    );
    expect(result).to.equal('/');
  });

  it('should handle whitelist with invalid URL entries', () => {
    const invalidWhitelist = ['http://valid.com', 'not-a-valid-url'];
    const result = validateRedirect('http://valid.com/page', invalidWhitelist);
    expect(result).to.equal('http://valid.com/page');
  });

  it('should reject URLs that try to exploit URL parsing', () => {
    // This is a URL that attempts to trick URL parsers by including an @ character
    const result = validateRedirect(
      'https://trusted.domain.org@evil.com',
      testWhitelist
    );
    expect(result).to.equal('/');
  });

  it('should reject URLs that try double-encoding attacks', () => {
    // Double-encoded URL that might bypass some filters
    const result = validateRedirect(
      'http://example.com%252Fevil.com',
      testWhitelist
    );
    expect(result).to.equal('/');
  });

  it('should reject null input by returning default path', () => {
    const result = validateRedirect(null as unknown as string, testWhitelist);
    expect(result).to.equal('/');
  });

  it('should allow non http/https mobile app protocol which is whitelisted', () => {
    const result = validateRedirect(
      'org.fedarch.faims3://auth-return',
      testWhitelist.concat('org.fedarch.faims3://')
    );
    expect(result).to.equal('org.fedarch.faims3://auth-return');
  });
});
