#!/bin/bash
# validate-saml-metadata.sh
# Validates the XML signature on SAML metadata

set -e

METADATA_URL="${1:-http://localhost:8080/auth/saml/metadata}"
TEMP_DIR=$(mktemp -d)
METADATA_FILE="$TEMP_DIR/metadata.xml"
CERT_FILE="$TEMP_DIR/signing-cert.pem"

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo "=== SAML Metadata Signature Validator ==="
echo ""

# Fetch metadata
echo "1. Fetching metadata from: $METADATA_URL"
if ! curl -s -f "$METADATA_URL" -o "$METADATA_FILE"; then
  echo "   ERROR: Failed to fetch metadata"
  exit 1
fi
echo "   OK: Metadata fetched ($(wc -c <"$METADATA_FILE") bytes)"
echo ""

# Check for signature
echo "2. Checking for signature element..."
if grep -q "<Signature" "$METADATA_FILE"; then
  echo "   OK: Signature element found"
else
  echo "   ERROR: No signature element found in metadata"
  exit 1
fi
echo ""

# Extract certificate from KeyDescriptor
echo "3. Extracting signing certificate from metadata..."
CERT_BASE64=$(xmllint --xpath "//*[local-name()='KeyDescriptor'][@use='signing']//*[local-name()='X509Certificate']/text()" "$METADATA_FILE" 2>/dev/null | tr -d '[:space:]')

if [ -z "$CERT_BASE64" ]; then
  echo "   WARNING: No signing certificate found in KeyDescriptor, trying without @use filter..."
  CERT_BASE64=$(xmllint --xpath "//*[local-name()='X509Certificate'][1]/text()" "$METADATA_FILE" 2>/dev/null | tr -d '[:space:]')
fi

if [ -z "$CERT_BASE64" ]; then
  echo "   ERROR: Could not extract certificate from metadata"
  exit 1
fi

# Write certificate to PEM file
echo "-----BEGIN CERTIFICATE-----" >"$CERT_FILE"
echo "$CERT_BASE64" | fold -w 64 >>"$CERT_FILE"
echo "-----END CERTIFICATE-----" >>"$CERT_FILE"
echo "   OK: Certificate extracted"
echo ""

# Display certificate info
echo "4. Certificate details:"
openssl x509 -in "$CERT_FILE" -noout -subject -issuer -dates 2>/dev/null | sed 's/^/   /'
echo ""

# Validate signature using xmlsec1
echo "5. Validating XML signature..."
if command -v xmlsec1 &>/dev/null; then
  if xmlsec1 --verify --pubkey-cert-pem "$CERT_FILE" --id-attr:ID "urn:oasis:names:tc:SAML:2.0:metadata:EntityDescriptor" "$METADATA_FILE" 2>&1; then
    echo ""
    echo "   ✓ SIGNATURE VALID"
  else
    echo ""
    echo "   ✗ SIGNATURE INVALID"
    exit 1
  fi
else
  echo "   WARNING: xmlsec1 not installed. Install with:"
  echo "      macOS:  brew install xmlsec1"
  echo "      Ubuntu: sudo apt-get install xmlsec1"
  echo ""
  echo "   Attempting basic structural validation only..."

  # Basic check: verify the digest value format
  DIGEST=$(xmllint --xpath "//*[local-name()='DigestValue']/text()" "$METADATA_FILE" 2>/dev/null)
  SIG=$(xmllint --xpath "//*[local-name()='SignatureValue']/text()" "$METADATA_FILE" 2>/dev/null | tr -d '[:space:]')

  if [ -n "$DIGEST" ] && [ -n "$SIG" ]; then
    echo "   DigestValue present: ${DIGEST:0:20}..."
    echo "   SignatureValue present: ${SIG:0:40}..."
    echo ""
    echo "   ⚠ Structure appears valid but cryptographic verification requires xmlsec1"
  else
    echo "   ERROR: Missing DigestValue or SignatureValue"
    exit 1
  fi
fi

echo ""
echo "=== Validation Complete ==="
