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
    /** The mimetype */
    mimeType: string;
  };
  recordContext: {
    // Which AVP is this related to?
    avpId: string;
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
 * Interface for the attachment service.
 */
export interface IAttachmentService {
  /**
   * Stores a File as an attachment.
   * @param params - The parameters for storing the file.
   * @param params.file - The File object to store.
   * @param params.metadata - Storage metadata including filename and mimeType.
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
   * @param params.metadata - Storage metadata including filename and mimeType.
   * @returns A Promise resolving to the storage result with identifier and metadata.
   */
  storeAttachmentFromBlob(params: {
    blob: Blob;
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
}

/**
 * Abstract base class for attachment services.
 */
export abstract class BaseAttachmentService implements IAttachmentService {
  /**
   * Stores a File as an attachment.
   * @param params - The parameters for storing the file.
   * @param params.file - The File object to store.
   * @param params.metadata - Storage metadata including filename and mimeType.
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
   * @param params.metadata - Storage metadata including filename and mimeType.
   * @returns A Promise resolving to the storage result with identifier and metadata.
   */
  abstract storeAttachmentFromBlob(params: {
    blob: Blob;
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
}
