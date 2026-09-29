// SPDX-License-Identifier: Apache-2.0
/*
 * Description:
 *   Pure SAML metadata XML transforms (no buildconfig), for tests and signing.
 */

/**
 * passport-saml does not emit errorURL; VANguard and other IdPs expect it on SPSSODescriptor.
 * Inserts the attribute on the first SPSSODescriptor element, before metadata signing.
 */
export const injectSpSsoDescriptorErrorUrl = (
  metadataXml: string,
  errorUrl: string
): string => {
  const url = errorUrl?.trim();
  if (!url) {
    return metadataXml;
  }
  if (/\berrorURL\s*=/i.test(metadataXml)) {
    return metadataXml;
  }
  const escaped = url
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');

  const withSpace = metadataXml.replace(
    '<SPSSODescriptor ',
    `<SPSSODescriptor errorURL="${escaped}" `
  );
  if (withSpace !== metadataXml) {
    return withSpace;
  }
  return metadataXml.replace(
    '<SPSSODescriptor>',
    `<SPSSODescriptor errorURL="${escaped}">`
  );
};
