/**
 * Enum representing the possible attachment service implementations.
 */
export enum AttachmentServiceType {
  /** CouchDB Attachment Service */
  COUCH = 'COUCH',
}

/**
 * Interface representing an attachment identifier.
 * The semantic meaning of this identifier is implementation-specific.
 * For example, in CouchDB it might be a document ID and attachment name.
 */
export interface AttachmentIdentifier {
  /** The identifier value - interpretation depends on the service implementation */
  id: string;
  /** Optional metadata about the identifier */
  metadata?: Record<string, unknown>;
}

/**
 * Interface used to help store attachments - this should be managed/used by the
 * service as needed
 */
export interface StorageMetadata {
  attachmentDetails: {
    /** A filename for the attachment */
    filename: string;
    /** The contentType */
    contentType: string;
  };
  recordContext: {
    // Which record?
    recordId: string;
    // Which revision?
    revisionId: string;
    // When was it created (ISO Date string)
    created: string;
    // Who created it (username)
    createdBy: string;
  };
}

/**
 * Interface for attachment metadata.
 */
export interface AttachmentMetadata {
  /** Original filename */
  filename: string;
  /** MIME type of the attachment */
  contentType: string;
  /** Additional implementation-specific metadata */
  [key: string]: unknown;
}

/**
 * Result of storing an attachment.
 */
export interface StoreAttachmentResult {
  /** The identifier for retrieving the attachment */
  identifier: AttachmentIdentifier;
  /** Metadata about the stored attachment */
  metadata: AttachmentMetadata;
}

/**
 * Result of loading an attachment.
 */
export interface LoadAttachmentResult {
  /** The attachment data as a Blob */
  blob: Blob;
  /** Metadata about the attachment */
  metadata: AttachmentMetadata;
}

/**
 * Result of loading an attachment as base64.
 */
export interface LoadAttachmentBase64Result {
  /** The attachment data as a base64 string */
  base64: string;
  /** Metadata about the attachment */
  metadata: AttachmentMetadata;
}

/**
 * Interface for the attachment service.
 */
export interface IAttachmentService {
  /**
   * Stores a File as an attachment.
   * @param params - The parameters for storing the file.
   * @param params.file - The File object to store.
   * @param params.metadata - Storage metadata including filename and contentType.
   * @returns A Promise resolving to the storage result with identifier and metadata.
   */
  storeAttachmentFromFile(params: {
    file: File;
    metadata: StorageMetadata;
  }): Promise<StoreAttachmentResult>;

  /**
   * Stores a Blob as an attachment.
   * @param params - The parameters for storing the blob.
   * @param params.blob - The Blob object to store.
   * @param params.metadata - Storage metadata including filename and contentType.
   * @returns A Promise resolving to the storage result with identifier and metadata.
   */
  storeAttachmentFromBlob(params: {
    blob: Blob;
    metadata: StorageMetadata;
  }): Promise<StoreAttachmentResult>;

  /**
   * Stores a base64-encoded string as an attachment.
   * @param params - The parameters for storing the base64 data.
   * @param params.base64 - The base64-encoded string to store.
   * @param params.metadata - Storage metadata including filename and contentType.
   * @returns A Promise resolving to the storage result with identifier and metadata.
   */
  storeAttachmentFromBase64(params: {
    base64: string;
    metadata: StorageMetadata;
  }): Promise<StoreAttachmentResult>;

  /**
   * Loads an attachment and returns it as a Blob.
   * @param params - The parameters for loading the attachment.
   * @param params.identifier - The identifier of the attachment to load.
   * @returns A Promise resolving to the attachment as a Blob with metadata.
   */
  loadAttachmentAsBlob(params: {
    identifier: AttachmentIdentifier;
  }): Promise<LoadAttachmentResult>;

  /**
   * Loads an attachment and returns it as a File.
   * @param params - The parameters for loading the attachment.
   * @param params.identifier - The identifier of the attachment to load.
   * @param params.filename - Optional filename to use for the File object. If not provided,
   *                          will attempt to use filename from metadata.
   * @returns A Promise resolving to the attachment as a File with metadata.
   */
  loadAttachmentAsFile(params: {
    identifier: AttachmentIdentifier;
    filename?: string;
  }): Promise<LoadAttachmentResult & {blob: File}>;

  /**
   * Loads an attachment and returns it as a base64-encoded string.
   * @param params - The parameters for loading the attachment.
   * @param params.identifier - The identifier of the attachment to load.
   * @returns A Promise resolving to the attachment as a base64 string with metadata.
   */
  loadAttachmentAsBase64(params: {
    identifier: AttachmentIdentifier;
  }): Promise<LoadAttachmentBase64Result>;
}

/**
 * Abstract base class for attachment services.
 */
export abstract class BaseAttachmentService implements IAttachmentService {
  /**
   * Stores a File as an attachment.
   * @param params - The parameters for storing the file.
   * @param params.file - The File object to store.
   * @param params.metadata - Storage metadata including filename and contentType.
   * @returns A Promise resolving to the storage result with identifier and metadata.
   */
  abstract storeAttachmentFromFile(params: {
    file: File;
    metadata: StorageMetadata;
  }): Promise<StoreAttachmentResult>;

  /**
   * Stores a Blob as an attachment.
   * @param params - The parameters for storing the blob.
   * @param params.blob - The Blob object to store.
   * @param params.metadata - Storage metadata including filename and contentType.
   * @returns A Promise resolving to the storage result with identifier and metadata.
   */
  abstract storeAttachmentFromBlob(params: {
    blob: Blob;
    metadata: StorageMetadata;
  }): Promise<StoreAttachmentResult>;

  /**
   * Stores a base64-encoded string as an attachment.
   * @param params - The parameters for storing the base64 data.
   * @param params.base64 - The base64-encoded string to store.
   * @param params.metadata - Storage metadata including filename and contentType.
   * @returns A Promise resolving to the storage result with identifier and metadata.
   */
  abstract storeAttachmentFromBase64(params: {
    base64: string;
    metadata: StorageMetadata;
  }): Promise<StoreAttachmentResult>;

  /**
   * Loads an attachment and returns it as a Blob.
   * @param params - The parameters for loading the attachment.
   * @param params.identifier - The identifier of the attachment to load.
   * @returns A Promise resolving to the attachment as a Blob with metadata.
   */
  abstract loadAttachmentAsBlob(params: {
    identifier: AttachmentIdentifier;
  }): Promise<LoadAttachmentResult>;

  /**
   * Loads an attachment and returns it as a File.
   * @param params - The parameters for loading the attachment.
   * @param params.identifier - The identifier of the attachment to load.
   * @param params.filename - Optional filename to use for the File object.
   * @returns A Promise resolving to the attachment as a File with metadata.
   */
  abstract loadAttachmentAsFile(params: {
    identifier: AttachmentIdentifier;
    filename?: string;
  }): Promise<LoadAttachmentResult & {blob: File}>;

  /**
   * Loads an attachment and returns it as a base64-encoded string.
   * @param params - The parameters for loading the attachment.
   * @param params.identifier - The identifier of the attachment to load.
   * @returns A Promise resolving to the attachment as a base64 string with metadata.
   */
  abstract loadAttachmentAsBase64(params: {
    identifier: AttachmentIdentifier;
  }): Promise<LoadAttachmentBase64Result>;

  /**
   * Helper method to convert a Blob to a File.
   * @param blob - The Blob to convert.
   * @param filename - The filename to use for the File.
   * @param lastModified - Optional last modified timestamp.
   * @returns A File object.
   */
  protected blobToFile(
    blob: Blob,
    filename: string,
    lastModified?: number
  ): File {
    return new File([blob], filename, {
      type: blob.type,
      lastModified: lastModified || Date.now(),
    });
  }

  /**
   * Helper method to convert a Blob to a base64 string.
   * @param blob - The Blob to convert.
   * @returns A Promise resolving to a base64-encoded string.
   */
  protected async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remove the data URL prefix (e.g., "data:image/png;base64,")
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Helper method to convert a base64 string to a Blob.
   * @param base64 - The base64-encoded string to convert.
   * @param contentType - The MIME type of the blob.
   * @returns A Blob object.
   */
  protected base64ToBlob(base64: string, contentType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], {type: contentType});
  }
}
