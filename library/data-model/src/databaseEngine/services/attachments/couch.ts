import {DatabaseInterface} from '../../../types';
import {CoreOperations, generateAttID} from '../../engine';
import {
  AttachmentDBDocument,
  DataDocument,
  NewPendingAttachmentDBDocument,
  PendingAttachment,
} from '../../types';
import {
  AttachmentIdentifier,
  BaseAttachmentService,
  LoadAttachmentBase64Result,
  LoadAttachmentResult,
  StorageMetadata,
  StoreAttachmentResult,
} from './types';
import {base64ToBlob, blobToBase64, fileToBase64} from './utils';

// The default att- prefix
export const ATTACHMENT_DEFAULT_PREFIX = 'att-';

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Configuration for CouchDB attachment service.
 */
export interface CouchAttachmentServiceConfig {
  /** The couchDB connection */
  dataDb: DatabaseInterface<DataDocument>;
  /** Optional prefix for attachment document IDs */
  documentIdPrefix?: string;
}

/**
 * Parameters for creating a CouchDB attachment service.
 */
interface CouchAttachmentServiceParams {
  /** CouchDB configuration */
  config: CouchAttachmentServiceConfig;
}

/**
 * CouchDB-based attachment service implementation.
 *
 * This service stores attachments as CouchDB document attachments.
 * The identifier format is implementation-specific and contains:
 * - Document ID where the attachment is stored
 * - Attachment name within that document
 *
 * @remarks
 * CouchDB stores attachments as part of documents. Each attachment has:
 * - A parent document ID
 * - An attachment name (used as the key)
 * - Content type
 * - Binary data
 *
 * The identifier returned by store methods encodes both the document ID
 * and attachment name, allowing retrieval via the load methods.
 */
export class CouchAttachmentService extends BaseAttachmentService {
  private config: CouchAttachmentServiceConfig;
  private core: CoreOperations;

  /**
   * Creates an instance of CouchAttachmentService.
   * @param params - The parameters for creating the service.
   * @param params.config - CouchDB configuration including URL, database name, and auth.
   */
  constructor({config}: CouchAttachmentServiceParams) {
    super();
    this.config = config;
    // Core Pouch DB operations - provides some nicer type safety and helpers
    this.core = new CoreOperations(this.config.dataDb);
  }

  /**
   * Stores a File as an attachment in CouchDB.
   *
   * @param params - The parameters for storing the file.
   * @param params.file - The File object to store.
   * @param params.metadata - Storage metadata with filename and contentType.
   * @returns A Promise resolving to the storage result with identifier and metadata.
   */
  async storeAttachmentFromFile(params: {
    file: File;
    metadata: StorageMetadata;
  }): Promise<StoreAttachmentResult> {
    const {file, metadata} = params;
    // Generate the att- ID
    const id = generateAttID();
    // Convert file to base64
    const base64Data = await fileToBase64(file);
    // Build the attachments (pending - i.e. data directly in there)
    const _attachments: {[key: string]: PendingAttachment} = {
      [id]: {
        content_type: metadata.attachmentDetails.contentType,
        data: base64Data,
      },
    };
    const attachmentDocument: NewPendingAttachmentDBDocument = {
      _id: id,
      _attachments,
      avp_id: metadata.recordContext.avpId,
      record_id: metadata.recordContext.recordId,
      filename: metadata.attachmentDetails.filename,
      revision_id: metadata.recordContext.revisionId,
      created: metadata.recordContext.created,
      created_by: metadata.recordContext.createdBy,
      attach_format_version: 1,
    };

    // Now write it using special core op
    try {
      await this.core.createAttachment(attachmentDocument);
    } catch (e) {
      console.error(
        'Failed to create attachment in couch DB attachment service. Error: ',
        e
      );
      throw e;
    }

    // Return info about the new document
    return {
      identifier: {id: id, metadata: {}},
      metadata: {
        contentType: metadata.attachmentDetails.contentType,
        filename: metadata.attachmentDetails.filename,
      },
    };
  }

  /**
   * Stores a Blob as an attachment in CouchDB.
   *
   * @param params - The parameters for storing the blob.
   * @param params.blob - The Blob object to store.
   * @param params.metadata - Storage metadata with filename and contentType.
   * @returns A Promise resolving to the storage result with identifier and metadata.
   */
  async storeAttachmentFromBlob(params: {
    blob: Blob;
    metadata: StorageMetadata;
  }): Promise<StoreAttachmentResult> {
    const {blob, metadata} = params;

    // Generate the att- ID
    const id = generateAttID();

    // Convert blob to base64
    const base64Data = await blobToBase64(blob);

    // Build the attachments (pending - i.e. data directly in there)
    const _attachments: {[key: string]: PendingAttachment} = {
      [id]: {
        content_type: metadata.attachmentDetails.contentType,
        data: base64Data,
      },
    };

    const attachmentDocument: NewPendingAttachmentDBDocument = {
      _id: id,
      _attachments,
      avp_id: metadata.recordContext.avpId,
      record_id: metadata.recordContext.recordId,
      filename: metadata.attachmentDetails.filename,
      revision_id: metadata.recordContext.revisionId,
      created: metadata.recordContext.created,
      created_by: metadata.recordContext.createdBy,
      attach_format_version: 1,
    };

    // Now write it using special core op
    try {
      await this.core.createAttachment(attachmentDocument);
    } catch (e) {
      console.error(
        'Failed to create attachment in couch DB attachment service. Error: ',
        e
      );
      throw e;
    }

    // Return info about the new document
    return {
      identifier: {id: id, metadata: {}},
      metadata: {
        contentType: metadata.attachmentDetails.contentType,
        filename: metadata.attachmentDetails.filename,
      },
    };
  }

  /**
   * Loads an attachment from CouchDB and returns it as a Blob.
   *
   * @param params - The parameters for loading the attachment.
   * @param params.identifier - The identifier of the attachment to load.
   *                            For CouchDB, contains document ID and attachment name.
   * @returns A Promise resolving to the attachment as a Blob with metadata.
   * ```
   */
  async loadAttachmentAsBlob(params: {
    identifier: AttachmentIdentifier;
  }): Promise<LoadAttachmentResult> {
    const {identifier} = params;

    // Fetch the record, load attachments
    const attachment = await this.core.db.get<AttachmentDBDocument>(
      identifier.id,
      {
        // include attachment
        attachments: true,
        // base 64 please
        binary: false,
      }
    );

    const attachmentDetails = attachment._attachments?.[identifier.id] as
      | (PouchDB.Core.Attachment & {
          // Base 64 encoded (include_attachments = true, binary = false)
          data: string;
        })
      | undefined;

    // Check if attachment exists
    if (!attachmentDetails || !attachmentDetails.data) {
      throw new Error(
        `Attachment with ID "${identifier.id}" not found or has no data`
      );
    }

    // Convert base64 string to Blob using utility function
    const blob = base64ToBlob(
      attachmentDetails.data,
      attachmentDetails.content_type
    );

    // Extract metadata from the attachment document
    const filename = attachment.filename || 'unknown';

    return {
      blob,
      metadata: {
        contentType: attachmentDetails.content_type,
        filename,
      },
    };
  }

  /**
   * Loads an attachment from CouchDB and returns it as a File.
   *
   * @param params - The parameters for loading the attachment.
   * @param params.identifier - The identifier of the attachment to load.
   * @param params.filename - Optional filename to use for the File object.
   *                          If not provided, will use filename from metadata.
   * @returns A Promise resolving to the attachment as a File with metadata.
   * ```
   */
  async loadAttachmentAsFile(params: {
    identifier: AttachmentIdentifier;
    filename?: string;
  }): Promise<LoadAttachmentResult & {blob: File}> {
    const {identifier, filename} = params;

    // First load as Blob
    const blobResult = await this.loadAttachmentAsBlob({identifier});

    // Determine final filename
    const finalFilename = filename ?? blobResult.metadata.filename;

    // Convert Blob to File using the helper method
    const file = this.blobToFile(blobResult.blob, finalFilename);

    return {
      blob: file,
      metadata: {
        ...blobResult.metadata,
        filename: finalFilename,
      },
    };
  }

  /**
   * Stores a base64-encoded string as an attachment in CouchDB.
   *
   * @param params - The parameters for storing the base64 data.
   * @param params.base64 - The base64-encoded string to store.
   * @param params.metadata - Storage metadata with filename and contentType.
   * @returns A Promise resolving to the storage result with identifier and metadata.
   */
  async storeAttachmentFromBase64(params: {
    base64: string;
    metadata: StorageMetadata;
  }): Promise<StoreAttachmentResult> {
    const {base64, metadata} = params;

    // Generate the att- ID
    const id = generateAttID();

    // Build the attachments (pending - i.e. data directly in there)
    const _attachments: {[key: string]: PendingAttachment} = {
      [id]: {
        content_type: metadata.attachmentDetails.contentType,
        data: base64,
      },
    };

    const attachmentDocument: NewPendingAttachmentDBDocument = {
      _id: id,
      _attachments,
      avp_id: metadata.recordContext.avpId,
      record_id: metadata.recordContext.recordId,
      filename: metadata.attachmentDetails.filename,
      revision_id: metadata.recordContext.revisionId,
      created: metadata.recordContext.created,
      created_by: metadata.recordContext.createdBy,
      attach_format_version: 1,
    };

    // Now write it using special core op
    try {
      await this.core.createAttachment(attachmentDocument);
    } catch (e) {
      console.error(
        'Failed to create attachment in couch DB attachment service. Error: ',
        e
      );
      throw e;
    }

    // Return info about the new document
    return {
      identifier: {id: id, metadata: {}},
      metadata: {
        contentType: metadata.attachmentDetails.contentType,
        filename: metadata.attachmentDetails.filename,
      },
    };
  }

  /**
   * Loads an attachment from CouchDB and returns it as a base64-encoded string.
   *
   * @param params - The parameters for loading the attachment.
   * @param params.identifier - The identifier of the attachment to load.
   * @returns A Promise resolving to the attachment as a base64 string with metadata.
   */
  async loadAttachmentAsBase64(params: {
    identifier: AttachmentIdentifier;
  }): Promise<LoadAttachmentBase64Result> {
    const {identifier} = params;

    // Fetch the record, load attachments
    const attachment = await this.core.db.get<AttachmentDBDocument>(
      identifier.id,
      {
        // include attachment
        attachments: true,
        // base 64 please
        binary: false,
      }
    );

    const attachmentDetails = attachment._attachments?.[identifier.id] as
      | (PouchDB.Core.Attachment & {
          // Base 64 encoded (include_attachments = true, binary = false)
          data: string;
        })
      | undefined;

    // Check if attachment exists
    if (!attachmentDetails || !attachmentDetails.data) {
      throw new Error(
        `Attachment with ID "${identifier.id}" not found or has no data`
      );
    }

    // Extract metadata from the attachment document
    const filename = attachment.filename || 'unknown';

    return {
      base64: attachmentDetails.data,
      metadata: {
        contentType: attachmentDetails.content_type,
        filename,
      },
    };
  }
}
