// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Converts an ArrayBuffer to a base64-encoded string.
 * @param buffer - The ArrayBuffer to convert.
 * @returns A base64-encoded string.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts a base64-encoded string to a Blob.
 * @param base64 - The base64-encoded string.
 * @param contentType - The MIME type of the content.
 * @returns A Blob containing the decoded data.
 */
export function base64ToBlob(base64: string, contentType: string): Blob {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], {type: contentType});
}

/**
 * Converts a File to a base64-encoded string.
 * @param file - The File to convert.
 * @returns A Promise resolving to a base64-encoded string.
 */
export async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  return arrayBufferToBase64(arrayBuffer);
}

/**
 * Converts a Blob to a base64-encoded string.
 * @param blob - The Blob to convert.
 * @returns A Promise resolving to a base64-encoded string.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  return arrayBufferToBase64(arrayBuffer);
}
