/**
 * passport-saml signs HTTP-POST AuthnRequest via xml-crypto@2 without KeyInfo, so the
 * Signature element has no X509Certificate. Some IdPs (e.g. Australian Government VANguard FAS)
 * require KeyInfo/X509Data per their service definition.
 *
 * This module replaces passport-saml/node-saml `signXml` when the SP signing certificate
 * is available (`publicKey` from merged auth config, same PEM as metadata).
 *
 * Must be imported before `passport-saml` loads `node-saml/saml.js` (see expressSetup / authRoutes).
 */

import path from 'path';

type SignXmlOptions = {
  privateKey?: string;
  publicKey?: string;
  publicCert?: string;
  signatureAlgorithm?: string;
  digestAlgorithm?: string;
  xmlSignatureTransforms?: string[];
};

type SignXmlFn = (
  xml: string,
  xpath: string,
  location: {reference: string; action: string},
  options: SignXmlOptions
) => string;

function stripPemToDerBase64(pem: string): string {
  return pem
    .replace(/\r\n/g, '\n')
    .trim()
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\n/g, '')
    .trim();
}

function createX509KeyInfoProvider(certPem: string) {
  const derB64 = stripPemToDerBase64(certPem);
  return {
    getKeyInfo(_signingKey: unknown, prefix?: string) {
      const p = prefix ? `${prefix}:` : '';
      return `<${p}X509Data><${p}X509Certificate>${derB64}</${p}X509Certificate></${p}X509Data>`;
    },
    getKey() {
      return null;
    },
  };
}

const passportSamlXmlDir = path.dirname(
  require.resolve('passport-saml/lib/node-saml/xml')
);

// xml-crypto major used by passport-saml (not the app-root xml-crypto@6 used for metadata).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const xmlCrypto = require(require.resolve('xml-crypto', {
  paths: [passportSamlXmlDir],
})) as {SignedXml: new () => Record<string, unknown>};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const xmlSigning = require('passport-saml/lib/node-saml/xml') as {signXml: SignXmlFn};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const algorithms = require('passport-saml/lib/node-saml/algorithms') as {
  getSigningAlgorithm: (shortName?: string) => string;
  getDigestAlgorithm: (shortName?: string) => string;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const types = require('passport-saml/lib/node-saml/types') as {
  isValidSamlSigningOptions: (options: unknown) => boolean;
};

const originalSignXml = xmlSigning.signXml;

xmlSigning.signXml = (
  xml: string,
  xpathExpr: string,
  location: {reference: string; action: string},
  options: SignXmlOptions
): string => {
  const publicCert =
    (typeof options.publicCert === 'string' && options.publicCert.trim()) ||
    (typeof options.publicKey === 'string' && options.publicKey.trim());
  if (!publicCert) {
    return originalSignXml(xml, xpathExpr, location, options);
  }

  const defaultTransforms = [
    'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
    'http://www.w3.org/2001/10/xml-exc-c14n#',
  ];
  if (!xml) {
    throw new Error('samlMessage is required');
  }
  if (!location) {
    throw new Error('location is required');
  }
  if (!options) {
    throw new Error('options is required');
  }
  if (!types.isValidSamlSigningOptions(options)) {
    throw new Error('options.privateKey is required');
  }
  const transforms = options.xmlSignatureTransforms ?? defaultTransforms;
  const sig = new xmlCrypto.SignedXml() as {
    addReference: (xp: string, trans: string[], digest: string) => void;
    signingKey: string;
    signatureAlgorithm: string;
    keyInfoProvider: ReturnType<typeof createX509KeyInfoProvider>;
    computeSignature: (x: string, o: {location: typeof location}) => void;
    getSignedXml: () => string;
  };
  if (options.signatureAlgorithm != null) {
    sig.signatureAlgorithm = algorithms.getSigningAlgorithm(
      options.signatureAlgorithm
    );
  }
  sig.addReference(
    xpathExpr,
    transforms,
    algorithms.getDigestAlgorithm(options.digestAlgorithm)
  );
  sig.signingKey = options.privateKey as string;
  sig.keyInfoProvider = createX509KeyInfoProvider(publicCert);
  sig.computeSignature(xml, {
    location,
  });
  return sig.getSignedXml();
};
