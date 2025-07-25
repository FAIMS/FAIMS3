import {expect} from 'chai';
import {validateRedirect} from '../src/auth/helpers';
import {CONDUCTOR_PUBLIC_URL} from '../src/buildconfig';

// Define the expected failure response structure
const expectedFailure = {valid: false, redirect: '/'};

describe('validateRedirect tests', () => {
  // Define a test whitelist that we'll use throughout the tests
  // Ensure CONDUCTOR_PUBLIC_URL is a valid URL string for these tests
  const testWhitelist = [
    'http://example.com',
    'https://trusted.domain.org',
    'http://localhost:3000',
    CONDUCTOR_PUBLIC_URL,
  ];

  // Add a custom scheme whitelist entry for testing
  const customScheme = 'org.fedarch.faims3://';
  const whitelistWithCustomScheme = [...testWhitelist, customScheme];

  it('should reject relative URLs', () => {
    const result = validateRedirect('/dashboard', testWhitelist);
    // Relative URLs cannot be parsed into an origin to match the whitelist
    expect(result).to.deep.equal(expectedFailure);
  });

  it('should reject relative URLs with query parameters', () => {
    const result = validateRedirect(
      '/dashboard?user=123&action=view',
      testWhitelist
    );
    expect(result).to.deep.equal(expectedFailure);
  });

  it('should reject relative URLs with hash fragments', () => {
    const result = validateRedirect('/dashboard#section1', testWhitelist);
    expect(result).to.deep.equal(expectedFailure);
  });

  it('should accept URLs from the whitelist', () => {
    const redirectUrl = 'http://example.com/path';
    const result = validateRedirect(redirectUrl, testWhitelist);
    expect(result).to.deep.equal({valid: true, redirect: redirectUrl});
  });

  it('should accept URLs from the whitelist with query parameters', () => {
    const redirectUrl = 'http://example.com/path?param=value';
    const result = validateRedirect(redirectUrl, testWhitelist);
    expect(result).to.deep.equal({valid: true, redirect: redirectUrl});
  });

  it('should accept URLs from the whitelist with hash fragments', () => {
    const redirectUrl = 'http://example.com/path#section';
    const result = validateRedirect(redirectUrl, testWhitelist);
    expect(result).to.deep.equal({valid: true, redirect: redirectUrl});
  });

  it('should reject URLs not in the whitelist', () => {
    const result = validateRedirect(
      'http://malicious.com/phishing',
      testWhitelist
    );
    expect(result).to.deep.equal(expectedFailure);
  });

  it('should reject URLs not in the whitelist that have same domain but different protocol', () => {
    const result = validateRedirect('https://example.com', testWhitelist);
    // Whitelist has 'http://example.com', protocols don't match
    expect(result).to.deep.equal(expectedFailure);
  });

  it('should reject URLs not in the whitelist that have same domain but different port', () => {
    const result = validateRedirect('http://localhost:2525', testWhitelist);
    // Whitelist has 'http://localhost:3000', ports don't match
    expect(result).to.deep.equal(expectedFailure);
  });

  it('should reject URLs with unrelated hostnames', () => {
    // Make sure we're matching full origins, not just checking if a domain contains a whitelisted domain
    const result = validateRedirect('http://evil-example.com', testWhitelist);
    expect(result).to.deep.equal(expectedFailure);
  });

  it('should reject URLs with subdomains of trusted domains if subdomain itself is not whitelisted', () => {
    const result = validateRedirect(
      'http://subdomain.example.com', // Not in whitelist
      testWhitelist // which contains 'http://example.com'
    );
    expect(result).to.deep.equal(expectedFailure);
  });

  it('should reject unparseable URLs', () => {
    const result = validateRedirect('not-a-valid-url', testWhitelist);
    // Fails URL.canParse()
    expect(result).to.deep.equal(expectedFailure);
  });

  it('should reject URLs with javascript: protocol', () => {
    const result = validateRedirect(
      'javascript:alert(document.cookie)',
      testWhitelist
    );
    // Protocol 'javascript:' won't match whitelisted protocols ('http:', 'https:')
    expect(result).to.deep.equal(expectedFailure);
  });

  it('should reject URLs with data: protocol', () => {
    const result = validateRedirect(
      'data:text/html,<script>alert(document.cookie)</script>',
      testWhitelist
    );
    // Protocol 'data:' won't match whitelisted protocols ('http:', 'https:')
    expect(result).to.deep.equal(expectedFailure);
  });

  it('should handle empty whitelist by rejecting all absolute URLs', () => {
    const result = validateRedirect('http://example.com', []);
    // Loop over whitelist is empty, fails
    expect(result).to.deep.equal(expectedFailure);
  });

  it('should handle empty redirect URLs by returning default', () => {
    const result = validateRedirect('', testWhitelist);
    // Fails !redirect check
    expect(result).to.deep.equal(expectedFailure);
  });

  it('should handle undefined redirect URLs by returning default', () => {
    const result = validateRedirect(
      undefined as unknown as string,
      testWhitelist
    );
    // Fails !redirect check
    expect(result).to.deep.equal(expectedFailure);
  });

  it('should handle null redirect URLs by returning default', () => {
    const result = validateRedirect(null as unknown as string, testWhitelist);
    // Fails !redirect check
    expect(result).to.deep.equal(expectedFailure);
  });

  it('should handle whitelist with invalid URL entries and still match valid ones', () => {
    const invalidWhitelist = ['not-a-valid-url', 'http://valid.com', 'bad%'];
    const redirectUrl = 'http://valid.com/page';
    const result = validateRedirect(redirectUrl, invalidWhitelist);
    // Skips invalid entries, finds 'http://valid.com'
    expect(result).to.deep.equal({valid: true, redirect: redirectUrl});
  });

  it('should reject if only invalid entries exist in whitelist', () => {
    const invalidWhitelist = ['not-a-valid-url', 'bad%'];
    const redirectUrl = 'http://valid.com/page';
    const result = validateRedirect(redirectUrl, invalidWhitelist);
    // Skips invalid entries, finds no match
    expect(result).to.deep.equal(expectedFailure);
  });

  it('should reject URLs that try to exploit URL parsing with userinfo (@)', () => {
    // This parses as user 'trusted.domain.org' host 'evil.com'
    const result = validateRedirect(
      'https://trusted.domain.org@evil.com',
      testWhitelist
    );
    // Origin 'https://evil.com' doesn't match 'https://trusted.domain.org'
    expect(result).to.deep.equal(expectedFailure);
  });

  it('should reject URLs containing encoded characters if origin matches', () => {
    // The origin of 'http://example.com%2Fpath' is 'http://example.com'
    // The function validates based on origin, but rejects encoded characters
    const redirectUrl = 'http://example.com%2Fpath'; // Encoded '/'
    const result = validateRedirect(redirectUrl, testWhitelist);
    // Origin 'http://example.com' matches whitelist 'http://example.com'
    expect(result).to.deep.equal(expectedFailure);
  });

  it('should allow non http/https mobile app protocol which is whitelisted', () => {
    const redirectUrl = 'org.fedarch.faims3://auth-return';
    const result = validateRedirect(redirectUrl, whitelistWithCustomScheme);
    // Origin 'org.fedarch.faims3://' matches whitelist entry 'org.fedarch.faims3://'
    expect(result).to.deep.equal({valid: true, redirect: redirectUrl});
  });

  it('should reject non http/https mobile app protocol which is NOT whitelisted', () => {
    const redirectUrl = 'some-other-app://auth-return';
    const result = validateRedirect(redirectUrl, whitelistWithCustomScheme);
    // Origin 'some-other-app://' does not match any whitelist entry
    expect(result).to.deep.equal(expectedFailure);
  });

  it('should correctly use CONDUCTOR_PUBLIC_URL from whitelist', () => {
    // Ensure CONDUCTOR_PUBLIC_URL is treated as a valid URL string
    const conductorUrl = CONDUCTOR_PUBLIC_URL || 'http://conductor.test.local';
    // Construct a redirect URL based on the potential CONDUCTOR_PUBLIC_URL
    const redirectUrl = `${conductorUrl}/some/path?query=1`;
    const result = validateRedirect(redirectUrl, testWhitelist);
    expect(result).to.deep.equal({valid: true, redirect: redirectUrl});
  });
});
