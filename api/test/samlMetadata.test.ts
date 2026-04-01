import {expect} from 'chai';
import {injectSpSsoDescriptorErrorUrl} from '../src/auth/strategies/samlMetadataXml';

describe('SAML metadata XML helpers', () => {
  describe('injectSpSsoDescriptorErrorUrl', () => {
    it('adds errorURL attribute before existing SPSSODescriptor attributes', () => {
      const xml =
        '<?xml version="1.0"?><EntityDescriptor><SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"></SPSSODescriptor></EntityDescriptor>';
      const out = injectSpSsoDescriptorErrorUrl(
        xml,
        'https://conduct.example/auth/vanguard/sso-error'
      );
      expect(out).to.include('errorURL="https://conduct.example/auth/vanguard/sso-error"');
      expect(out).to.include('<SPSSODescriptor errorURL=');
    });

    it('escapes XML attribute characters', () => {
      const xml =
        '<EntityDescriptor><SPSSODescriptor protocolSupportEnumeration="x"></SPSSODescriptor></EntityDescriptor>';
      const out = injectSpSsoDescriptorErrorUrl(
        xml,
        'https://ex.example/page?q=1&foo=a"b'
      );
      expect(out).to.include('&amp;');
      expect(out).to.include('&quot;');
    });

    it('is idempotent when errorURL already present', () => {
      const xml =
        '<SPSSODescriptor errorURL="https://already.set/" protocolSupportEnumeration="x">';
      expect(injectSpSsoDescriptorErrorUrl(xml, 'https://other/')).to.equal(xml);
    });
  });
});
