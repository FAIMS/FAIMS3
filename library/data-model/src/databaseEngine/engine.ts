import {v4 as uuidv4} from 'uuid';
import {z} from 'zod';
import {DatabaseInterface, FAIMSTypeName, UISpecification} from '../types';
import {
  AvpDBDocument,
  DataDocument,
  ExistingAttachmentDBDocument,
  ExistingAvpDBDocument,
  ExistingFormRecord,
  existingFormRecordSchema,
  ExistingRecordDBDocument,
  ExistingRevisionDBDocument,
  getDocumentType,
  HydratedDataField,
  HydratedRecord,
  isExistingAttachmentDocument,
  isExistingAvpDocument,
  isExistingRecordDocument,
  isExistingRevisionDocument,
  NewAttachmentDBDocument,
  NewAvpDBDocument,
  NewFormRecord,
  newFormRecordSchema,
  NewRecordDBDocument,
  NewRevisionDBDocument,
  validateExistingAttachmentDocument,
  validateExistingAvpDocument,
  validateExistingRecordDocument,
  validateExistingRevisionDocument,
} from './types';

// Helpers

function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

// =========
// CONSTANTS
// =========

export const UNKNOWN_TYPE_FALLBACK = '??:??';

// ============================================================================
// Configuration Schemas and Types
// ============================================================================

/**
 * Configuration options for the DataEngine
 *
 * @property dbName - The name of the PouchDB database
 * @property pouchConfig - Optional PouchDB configuration options
 */
export interface DataEngineConfig {
  dataDb: DatabaseInterface<DataDocument>;
  pouchConfig?: PouchDB.Configuration.DatabaseConfiguration;
  uiSpec: UISpecification;
}

/**
 * Configuration for hydrated record retrieval behavior
 *
 * @property behaviorOnConflict - Strategy for handling conflicting record heads
 */
export const hydratedRecordConfigSchema = z.object({
  behaviorOnConflict: z
    .enum(['throw', 'pickFirst', 'pickLast'])
    .default('throw'),
});

export type HydratedRecordConfig = z.infer<typeof hydratedRecordConfigSchema>;

/**
 * Configuration for form record operations
 *
 * @property getEqualityFunctionForType - Function to get equality checker for field type comparison
 */
export interface FormRecordEngineConfig {
  getEqualityFunctionForType: (
    type: FAIMSTypeName
  ) => (a: any, b: any) => Promise<boolean>;
}

export type ConflictBehavior = z.infer<
  typeof hydratedRecordConfigSchema
>['behaviorOnConflict'];

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when a document is not found in the database
 */
export class DocumentNotFoundError extends Error {
  constructor(id: string, type: string) {
    super(`${type} document with id "${id}" not found`);
    this.name = 'DocumentNotFoundError';
  }
}

/**
 * Error thrown when a document has an unexpected type
 */
export class InvalidDocumentTypeError extends Error {
  constructor(id: string, expectedType: string, actualType: string) {
    super(
      `Document "${id}" is of type "${actualType}", expected "${expectedType}"`
    );
    this.name = 'InvalidDocumentTypeError';
  }
}

/**
 * Error thrown when a record has multiple conflicting heads
 */
export class RecordConflictError extends Error {
  constructor(
    recordId: string,
    public readonly heads: string[]
  ) {
    super(
      `Record "${recordId}" has ${heads.length} conflicting heads: ${heads.join(', ')}`
    );
    this.name = 'RecordConflictError';
  }
}

/**
 * Error thrown when a record has no heads (invalid state)
 */
export class NoHeadsError extends Error {
  constructor(recordId: string) {
    super(`Record "${recordId}" has no heads - invalid state`);
    this.name = 'NoHeadsError';
  }
}

// ============================================================================
// ID Generation Utilities
// ============================================================================

/**
 * Generate a unique Record ID with the 'rec-' prefix
 *
 * @returns A new UUID-based record ID
 */
export function generateRecordID(): string {
  return 'rec-' + uuidv4();
}

/**
 * Generate a unique revision ID with the 'frev-' prefix
 *
 * @returns A new UUID-based revision ID
 */
export function generateRevisionID(): string {
  return 'frev-' + uuidv4();
}

/**
 * Generate a unique AVP (Attribute-Value-Pair) ID with the 'avp-' prefix
 *
 * @returns A new UUID-based AVP ID
 */
export function generateAvpID(): string {
  return 'avp-' + uuidv4();
}

/**
 * Generate a unique attachment ID with the 'att-' prefix
 *
 * @returns A new UUID-based Attachment ID
 */
export function generateAttID(): string {
  return 'att-' + uuidv4();
}

// ============================================================================
// Document Type Configuration
// ============================================================================

/**
 * Document type metadata for type-safe operations
 *
 * @property typeName - Human-readable name of the document type
 * @property typeGuard - Function to check if a document matches this type
 * @property validator - Function to validate and parse document data
 */
type DocumentTypeConfig<T> = {
  typeName: string;
  typeGuard: (doc: unknown) => boolean;
  validator: (doc: unknown) => T;
};

// ===========
// DataEngine
// ===========

/**
 * Unified data engine providing typed, ergonomic API for all database operations.
 * Includes embedded Core, Hydrated, and Form submodules for different access patterns.
 *
 * @example
 * const engine = new DataEngine({ dbName: 'mydb' });
 *
 * // Core operations
 * const record = await engine.core.getRecord('record-123');
 *
 * // Hydrated operations (with relationships loaded)
 * const hydrated = await engine.hydrated.getHydratedRecord('record-123');
 *
 * // Form operations (high-level CRUD)
 * await engine.form.createRecord(formData);
 */
export class DataEngine {
  private db: DatabaseInterface;

  /**
   * Core database operations - direct CRUD on typed documents
   */
  public readonly core: CoreOperations;

  /**
   * Hydrated record operations - fetch records with all relationships loaded
   */
  public readonly hydrated: HydratedOperations;

  /**
   * Form record operations - high-level create/update from form data
   */
  public readonly form: FormOperations;

  /**
   * UI Specification
   * NOTE: Currently unused, but placeholder for future where we may validate.
   */
  public readonly uiSpec: UISpecification;

  /**
   * Create a new DataEngine instance
   *
   * @param config - Database configuration including name and project ID
   */
  constructor(config: DataEngineConfig) {
    this.db = config.dataDb;
    this.uiSpec = config.uiSpec;
    this.core = new CoreOperations(this.db);
    this.hydrated = new HydratedOperations(this.core);
    this.form = new FormOperations(this.core, this.uiSpec);
  }

  /**
   * Get the underlying PouchDB database instance
   *
   * @returns The PouchDB database
   */
  getDb(): DatabaseInterface {
    return this.db;
  }

  /**
   * Configure the form operations module with type-specific handlers
   *
   * @param config - Configuration for form operations including equality and attachment handlers
   */
  configureForm(config: FormRecordEngineConfig): void {
    this.form.configure(config);
  }
}

// ============================================================================
// Core Operations - Direct Database CRUD
// ============================================================================

/**
 * Core database operations providing type-safe CRUD for all document types.
 * This is the lowest-level API for direct database access.
 */
class CoreOperations {
  private static readonly TYPE_CONFIGS = {
    record: {
      typeName: 'record',
      typeGuard: isExistingRecordDocument,
      validator: validateExistingRecordDocument,
    },
    revision: {
      typeName: 'revision',
      typeGuard: isExistingRevisionDocument,
      validator: validateExistingRevisionDocument,
    },
    avp: {
      typeName: 'avp',
      typeGuard: isExistingAvpDocument,
      validator: validateExistingAvpDocument,
    },
    attachment: {
      typeName: 'attachment',
      typeGuard: isExistingAttachmentDocument,
      validator: validateExistingAttachmentDocument,
    },
  } as const;

  constructor(private readonly db: DatabaseInterface) {}

  // ============================================================================
  // Generic Helper Methods
  // ============================================================================

  /**
   * Generic get operation with type checking and validation
   *
   * @param id - The document ID to retrieve
   * @param config - The document type configuration for validation
   * @returns The validated document with _rev
   * @throws DocumentNotFoundError if document doesn't exist
   * @throws InvalidDocumentTypeError if document has wrong type
   */
  private async getDocumentOfType<T>(
    id: string,
    config: DocumentTypeConfig<T>
  ): Promise<T & {_rev: string}> {
    try {
      const doc = await this.db.get(id);

      if (!config.typeGuard(doc)) {
        const actualType = getDocumentType(doc);
        throw new InvalidDocumentTypeError(id, config.typeName, actualType);
      }

      return config.validator(doc) as T & {_rev: string};
    } catch (err: any) {
      if (err.status === 404) {
        throw new DocumentNotFoundError(
          id,
          config.typeName.charAt(0).toUpperCase() + config.typeName.slice(1)
        );
      }
      throw err;
    }
  }

  /**
   * Generic create operation with validation
   *
   * @param doc - The document to create (without _rev)
   * @param config - The document type configuration for validation
   * @returns The created document with _rev
   * @throws Error if creation fails
   */
  private async createDocument<T extends {_id: string}>(
    doc: Omit<T, '_rev'>,
    config: DocumentTypeConfig<T>
  ): Promise<T & {_rev: string}> {
    const validated = config.validator(doc);
    const response = await this.db.put(validated);

    if (!response.ok) {
      throw new Error(`Failed to create ${config.typeName}: ${response}`);
    }

    return {
      ...validated,
      _rev: response.rev,
    };
  }

  /**
   * Generic update operation with validation and automatic conflict resolution
   *
   * @param doc - The document to update, must include _id and _rev
   * @param config - The document type configuration for validation
   * @param writeOnClash - If true, resolves conflicts by retrying with the latest _rev.
   *                       If false, returns undefined when a conflict is detected.
   *                       Default: true
   * @param maxRetries - Maximum number of retry attempts when conflicts occur.
   *                     Only applies when writeOnClash is true.
   *                     Default: 5
   * @returns The updated document with new _rev, or undefined if conflict occurs and writeOnClash is false
   * @throws Error if update fails (non-conflict error or max retries exceeded)
   */
  private async updateDocument<T extends {_id: string; _rev: string}>(
    doc: T,
    config: DocumentTypeConfig<T>,
    writeOnClash = true,
    maxRetries = 5
  ): Promise<T | undefined> {
    const validated = config.validator(doc);

    // Try to put directly - if no clash, succeeds immediately
    try {
      const response = await this.db.put(validated);
      if (!response.ok) {
        throw new Error(`Failed to update ${config.typeName}: ${response}`);
      }
      return {
        ...validated,
        _rev: response.rev,
      };
    } catch (err: any) {
      // If 409 - that's a conflict - handle based on writeOnClash setting
      if (err.status === 409) {
        if (writeOnClash) {
          // Retry logic: fetch latest _rev and attempt write again
          let attempts = 0;
          while (attempts < maxRetries) {
            try {
              const existingRecord = await this.db.get<T>(doc._id);
              // Update _rev with latest version, revalidate, and retry the write
              const updatedDoc = config.validator({
                ...validated,
                _rev: existingRecord._rev,
              });
              const response = await this.db.put(updatedDoc);
              if (!response.ok) {
                throw new Error(
                  `Failed to update ${config.typeName}: ${response}`
                );
              }
              return {
                ...updatedDoc,
                _rev: response.rev,
              };
            } catch (retryErr: any) {
              attempts++;
              // If it's another 409 and we haven't hit max retries, continue loop
              if (retryErr.status === 409 && attempts < maxRetries) {
                continue;
              }
              // Either hit max retries or encountered a different error
              throw new Error(
                `Failed to update ${config.typeName} after ${attempts} attempt(s). ` +
                  `Error: ${retryErr}`
              );
            }
          }
          // This shouldn't be reached, but just in case
          throw new Error(
            `Failed to update ${config.typeName} after ${maxRetries} retries`
          );
        } else {
          // Conflict occurred but writeOnClash is false - return undefined
          return undefined;
        }
      } else {
        // Non-conflict error occurred - log and throw
        console.log(err);
        throw new Error(
          `Failed to update ${config.typeName} - non 409 error: ${err}`
        );
      }
    }
  }

  // ============================================================================
  // GET Operations
  // ============================================================================

  /**
   * Get a record document by ID
   *
   * @param id - The record document ID
   * @returns The existing record document with metadata
   * @throws DocumentNotFoundError if record doesn't exist
   */
  async getRecord(id: string): Promise<ExistingRecordDBDocument> {
    return this.getDocumentOfType(id, CoreOperations.TYPE_CONFIGS.record);
  }

  /**
   * Get a revision document by ID
   *
   * @param id - The revision document ID
   * @returns The existing revision document with AVP references
   * @throws DocumentNotFoundError if revision doesn't exist
   */
  async getRevision(id: string): Promise<ExistingRevisionDBDocument> {
    return this.getDocumentOfType(id, CoreOperations.TYPE_CONFIGS.revision);
  }

  /**
   * Get an AVP (Attribute-Value-Pair) document by ID
   *
   * @param id - The AVP document ID
   * @returns The existing AVP document with field data
   * @throws DocumentNotFoundError if AVP doesn't exist
   */
  async getAvp(id: string): Promise<ExistingAvpDBDocument> {
    return this.getDocumentOfType(id, CoreOperations.TYPE_CONFIGS.avp);
  }

  /**
   * Get an attachment document by ID
   *
   * @param id - The attachment document ID
   * @returns The existing attachment document
   * @throws DocumentNotFoundError if attachment doesn't exist
   */
  async getAttachment(id: string): Promise<ExistingAttachmentDBDocument> {
    return this.getDocumentOfType(id, CoreOperations.TYPE_CONFIGS.attachment);
  }

  // ============================================================================
  // CREATE Operations
  // ============================================================================

  /**
   * Create a new record document
   *
   * @param record - The record document to create (without _rev)
   * @returns The created record with _rev
   * @throws Error if creation fails
   */
  async createRecord(
    record: NewRecordDBDocument
  ): Promise<ExistingRecordDBDocument> {
    return this.createDocument(record, CoreOperations.TYPE_CONFIGS.record);
  }

  /**
   * Create a new revision document
   *
   * @param revision - The revision document to create (without _rev)
   * @returns The created revision with _rev
   * @throws Error if creation fails
   */
  async createRevision(
    revision: NewRevisionDBDocument
  ): Promise<ExistingRevisionDBDocument> {
    return this.createDocument(revision, CoreOperations.TYPE_CONFIGS.revision);
  }

  /**
   * Create a new AVP document
   *
   * @param avp - The AVP document to create (without _rev)
   * @returns The created AVP with _rev
   * @throws Error if creation fails
   */
  async createAvp(avp: NewAvpDBDocument): Promise<ExistingAvpDBDocument> {
    return this.createDocument(avp, CoreOperations.TYPE_CONFIGS.avp);
  }

  /**
   * Create a new attachment document
   *
   * @param attachment - The attachment document to create (without _rev)
   * @returns The created attachment with _rev
   * @throws Error if creation fails
   */
  async createAttachment(
    attachment: NewAttachmentDBDocument
  ): Promise<ExistingAttachmentDBDocument> {
    return this.createDocument(
      attachment,
      CoreOperations.TYPE_CONFIGS.attachment
    );
  }

  // ============================================================================
  // UPDATE Operations
  // ============================================================================

  /**
   * Update an existing record document
   *
   * @param record - The record document to update (must include _id and _rev)
   * @returns The updated record with new _rev
   * @throws Error if update fails or document doesn't exist
   */
  async updateRecord(
    record: ExistingRecordDBDocument
  ): Promise<ExistingRecordDBDocument> {
    // This will throw - not be undefined
    return (await this.updateDocument(
      record,
      CoreOperations.TYPE_CONFIGS.record
    ))!;
  }

  /**
   * Update an existing revision document
   *
   * @param revision - The revision document to update (must include _id and _rev)
   * @returns The updated revision with new _rev
   * @throws Error if update fails or document doesn't exist
   */
  async updateRevision(
    revision: ExistingRevisionDBDocument
  ): Promise<ExistingRevisionDBDocument> {
    // This will throw - not be undefined
    return (await this.updateDocument(
      revision,
      CoreOperations.TYPE_CONFIGS.revision
    ))!;
  }

  /**
   * Update an existing AVP document
   *
   * @param avp - The AVP document to update (must include _id and _rev)
   * @returns The updated AVP with new _rev
   * @throws Error if update fails or document doesn't exist
   */
  async updateAvp(avp: ExistingAvpDBDocument): Promise<ExistingAvpDBDocument> {
    // This will throw - not be undefined
    return (await this.updateDocument(avp, CoreOperations.TYPE_CONFIGS.avp))!;
  }

  /**
   * Update an existing attachment document
   *
   * @param attachment - The attachment document to update (must include _id and _rev)
   * @returns The updated attachment with new _rev
   * @throws Error if update fails or document doesn't exist
   */
  async updateAttachment(
    attachment: ExistingAttachmentDBDocument
  ): Promise<ExistingAttachmentDBDocument> {
    return (await this.updateDocument(
      // This will throw - not be undefined
      attachment,
      CoreOperations.TYPE_CONFIGS.attachment
    ))!;
  }

  // ============================================================================
  // DELETE Operations
  // ============================================================================

  /**
   * Delete a document by ID and revision
   *
   * @param id - The document ID to delete
   * @param rev - The current document revision
   * @throws Error if deletion fails
   */
  async deleteDocument(id: string, rev: string): Promise<void> {
    const response = await this.db.remove(id, rev);

    if (!response.ok) {
      throw new Error(`Failed to delete document: ${response}`);
    }
  }

  /**
   * Delete a record document
   *
   * @param record - The record document to delete
   * @throws Error if deletion fails
   */
  async deleteRecord(record: ExistingRecordDBDocument): Promise<void> {
    await this.deleteDocument(record._id, record._rev);
  }

  /**
   * Delete a revision document
   *
   * @param revision - The revision document to delete
   * @throws Error if deletion fails
   */
  async deleteRevision(revision: ExistingRevisionDBDocument): Promise<void> {
    await this.deleteDocument(revision._id, revision._rev);
  }

  /**
   * Delete an AVP document
   *
   * @param avp - The AVP document to delete
   * @throws Error if deletion fails
   */
  async deleteAvp(avp: ExistingAvpDBDocument): Promise<void> {
    await this.deleteDocument(avp._id, avp._rev);
  }

  /**
   * Delete an attachment document
   *
   * @param attachment - The attachment document to delete
   * @throws Error if deletion fails
   */
  async deleteAttachment(
    attachment: ExistingAttachmentDBDocument
  ): Promise<void> {
    await this.deleteDocument(attachment._id, attachment._rev);
  }

  /**
   * Get the underlying PouchDB database instance
   *
   * @returns The PouchDB database
   */
  getDb() {
    return this.db;
  }
}

// ============================================================================
// Hydrated Operations - Records with Full Relationships
// ============================================================================

/**
 * Hydrated record operations that fetch records with all their relationships loaded.
 * This includes the record, its head revision, and all AVPs (field data) in a single call.
 */
class HydratedOperations {
  constructor(private readonly core: CoreOperations) {}

  /**
   * Resolve which head revision to use when multiple heads exist (conflict)
   *
   * @param recordId - The record ID experiencing conflict
   * @param heads - Array of conflicting head revision IDs
   * @param behavior - Strategy for resolving conflicts
   * @returns The selected head ID and whether a conflict was detected
   * @throws NoHeadsError if heads array is empty
   * @throws RecordConflictError if behavior is 'throw' and multiple heads exist
   */
  private resolveHead(
    recordId: string,
    heads: string[],
    behavior: ConflictBehavior
  ): {selectedHead: string; hadConflict: boolean} {
    if (heads.length === 0) {
      throw new NoHeadsError(recordId);
    }

    if (heads.length === 1) {
      return {
        selectedHead: heads[0],
        hadConflict: false,
      };
    }

    // Multiple heads - conflict detected
    switch (behavior) {
      case 'throw':
        throw new RecordConflictError(recordId, heads);
      // Take the first one
      case 'pickFirst':
        return {
          selectedHead: heads[0],
          hadConflict: true,
        };
      // Take the last one
      case 'pickLast':
        return {
          selectedHead: heads[heads.length - 1],
          hadConflict: true,
        };
    }
  }

  /**
   * Fetch all AVP documents for a revision efficiently in parallel
   *
   * @param avpIds - Map of field names to AVP document IDs
   * @returns Map of field names to fully loaded AVP documents
   * @throws Error if any AVP cannot be retrieved
   */
  private async fetchAvps(
    avpIds: Record<string, string>
  ): Promise<Record<string, ExistingAvpDBDocument>> {
    const entries = Object.entries(avpIds);

    // Fetch all AVPs in parallel for efficiency
    const avpPromises = entries.map(async ([fieldName, avpId]) => {
      const avp = await this.core.getAvp(avpId);
      return {fieldName, avp};
    });

    const results = await Promise.all(avpPromises);

    // Build the data object
    const data: Record<string, ExistingAvpDBDocument> = {};
    for (const {fieldName, avp} of results) {
      data[fieldName] = avp;
    }

    return data;
  }

  /**
   * Get a fully hydrated record with its latest revision and all AVPs loaded
   *
   * @param recordId - The record ID to hydrate
   * @param config - Configuration for conflict resolution
   * @returns Hydrated record with all data and metadata
   * @throws DocumentNotFoundError if record doesn't exist
   * @throws RecordConflictError if conflict behavior is 'throw' and multiple heads exist
   * @throws NoHeadsError if record has no heads
   */
  async getHydratedRecord(
    recordId: string,
    config: Partial<HydratedRecordConfig> = {}
  ): Promise<HydratedRecord> {
    // Validate and set defaults for config
    const validatedConfig = hydratedRecordConfigSchema.parse(config);

    // Step 1: Fetch the record
    const record = await this.core.getRecord(recordId);

    // Step 2: Resolve which head to use
    const {selectedHead, hadConflict} = this.resolveHead(
      recordId,
      record.heads,
      validatedConfig.behaviorOnConflict
    );

    // Step 3: Fetch the revision
    const revision = await this.core.getRevision(selectedHead);

    // Step 4: Fetch all AVPs efficiently
    const data = await this.fetchAvps(revision.avps);

    // Map the AVPs into our preferred external interface
    const mappedData: Record<string, HydratedDataField> = {};
    Array.from(Object.keys(data)).forEach(k => {
      const val = data[k];
      mappedData[k] = {
        _id: val._id,
        _rev: val._rev,
        created: val.created,
        createdBy: val.created_by,
        recordId: val.record_id,
        revisionId: val.revision_id,
        type: val.type,
        annotations: val.annotations,
        data: val.data,
        faimsAttachments: val.faims_attachments
          ? val.faims_attachments.map(att => ({
              attachmentId: att.attachment_id,
              filename: att.filename,
              fileType: att.file_type,
            }))
          : undefined,
      };
    });

    // Step 5: Build the hydrated record (in our external interface)
    return {
      record: {
        _id: record._id,
        _rev: record._rev,
        created: record.created,
        createdBy: record.created_by,
        formId: record.type,
        heads: record.heads,
        revisions: record.revisions,
      },
      revision: {
        _id: revision._id,
        _rev: revision._rev,
        avps: revision.avps,
        created: revision.created,
        createdBy: revision.created_by,
        formId: revision.type,
        parents: revision.parents,
        recordId: revision.record_id,
        relationship: revision.relationship,
      },
      data: mappedData,
      metadata: {
        hadConflict,
        conflictResolution: hadConflict
          ? validatedConfig.behaviorOnConflict
          : undefined,
        allHeads: record.heads,
      },
    };
  }

  /**
   * Get multiple hydrated records efficiently in parallel
   *
   * @param recordIds - Array of record IDs to hydrate
   * @param config - Configuration for conflict resolution
   * @returns Array of hydrated records in same order as input IDs
   * @throws DocumentNotFoundError if any record doesn't exist
   */
  async getHydratedRecords(
    recordIds: string[],
    config: Partial<HydratedRecordConfig> = {}
  ): Promise<HydratedRecord[]> {
    // Fetch all records in parallel
    const promises = recordIds.map(id => this.getHydratedRecord(id, config));
    return Promise.all(promises);
  }

  /**
   * Check if a record has conflicting heads
   *
   * @param recordId - The record ID to check
   * @returns True if record has multiple heads (conflict exists)
   * @throws DocumentNotFoundError if record doesn't exist
   */
  async hasConflict(recordId: string): Promise<boolean> {
    const record = await this.core.getRecord(recordId);
    return record.heads.length > 1;
  }

  /**
   * Get all head revision IDs for a record
   *
   * @param recordId - The record ID to query
   * @returns Array of head revision IDs
   * @throws DocumentNotFoundError if record doesn't exist
   */
  async getHeads(recordId: string): Promise<string[]> {
    const record = await this.core.getRecord(recordId);
    return record.heads;
  }
}

// ============================================================================
// Form Operations - High-Level CRUD from Form Data
// ============================================================================

/**
 * Form record operations providing high-level create/update interface.
 * Handles complex logic like change detection, AVP reuse, and attachment processing.
 */
class FormOperations {
  private readonly uiSpec: UISpecification;

  private getEqualityFn?: (
    type: FAIMSTypeName
  ) => (a: any, b: any) => Promise<boolean>;

  constructor(
    private readonly core: CoreOperations,
    uiSpec: UISpecification
  ) {
    this.uiSpec = uiSpec;
  }

  /**
   * Configure the form operations with type-specific handlers
   *
   * @param config - Configuration including equality and attachment handlers
   */
  configure(config: FormRecordEngineConfig): void {
    this.getEqualityFn = config.getEqualityFunctionForType;
  }

  /**
   * Create a brand new record from form data.
   *
   * The input here is the form data which the app currently produces.
   *
   * NOTE we may wish to consider moving the ID generation functions to this
   * module, and a 'seed' method rather than create which allows for
   * incomplete/empty data.
   *
   * @param formRecord - The form data to create a record from
   * @returns The ID of the newly created revision
   * @throws Error if revision_id is not null (should use updateRecord instead)
   * @throws Error if record creation fails
   */
  async createRecord(formRecord: NewFormRecord): Promise<string> {
    // Validate form record
    const validated = newFormRecordSchema.parse(formRecord);

    // Generate new record Id
    const recordId = generateRecordID();

    // Generate new revision ID
    const revisionId = generateRevisionID();

    // Step 1: Create Record document
    const recordDoc: NewRecordDBDocument = {
      _id: recordId,
      // Type marker
      record_format_version: 1,
      created: getCurrentTimestamp(),
      created_by: validated.createdBy,
      // Track a single revision and this is the active head
      revisions: [revisionId],
      heads: [revisionId],
      // The type == the form ID
      type: validated.formId,
    };

    try {
      await this.core.createRecord(recordDoc);
    } catch (err: any) {
      // NOTE we should validate this assertion... If record already exists,
      // that's fine - we just want to ensure it exists
      if (err.status !== 409) {
        throw err;
      }
    }

    // Step 2: Create AVPs for all fields
    const avpMap = await this.createAvpsForAllFields({
      formRecord: validated,
      revisionId,
      recordId,
    });

    // Step 3: Create Revision document
    const revisionDoc: NewRevisionDBDocument = {
      _id: revisionId,
      revision_format_version: 1,
      avps: avpMap,
      record_id: recordId,
      parents: [],
      created: getCurrentTimestamp(),
      created_by: validated.createdBy,
      type: validated.formId,
      // This is about annotating documents with issues - but is unused
      ugc_comment: '',
      relationship: validated.relationship ?? {},
    };

    await this.core.createRevision(revisionDoc);

    return revisionId;
  }

  /**
   * Update an existing record from form data using equality based change detection
   *
   * NOTE: it is expected that
   *
   * a) the recordID refers to existing record
   * b) the revisionID refers to _current_ revision
   * c) the data is the _new_ data
   *
   * @param formRecord - The form data with changes to apply
   * @returns The ID of the newly created revision
   * @throws Error if revision_id is null (should use createRecord instead)
   * @throws Error if parent revision not found
   * @throws Error if update fails
   */
  async updateRecord(formRecord: ExistingFormRecord): Promise<string> {
    // Validate form record
    const validated = existingFormRecordSchema.parse(formRecord);

    // Generate new revision ID
    const newRevisionId = generateRevisionID();

    // Step 1: Fetch parent revision to compare
    const parentRevision = await this.core.getRevision(validated.revisionId);

    // Step 2: Determine which AVPs need to be created (changed fields)
    const avpMap = await this.createOrReuseAvps({
      formRecord: validated,
      parentRevision,
      newRevisionId,
    });

    // Step 3: Create new Revision document
    const revisionDoc: NewRevisionDBDocument = {
      _id: newRevisionId,
      revision_format_version: 1,
      avps: avpMap,
      record_id: validated.recordId,
      parents: [validated.revisionId],
      created: getCurrentTimestamp(),
      created_by: validated.updatedBy,
      type: validated.formId,
      // This is about annotating documents with issues - but is unused
      ugc_comment: '',
      relationship: validated.relationship ?? {},
    };

    await this.core.createRevision(revisionDoc);

    // Step 4: Update Record document heads
    await this.updateRecordHeads({
      // Old
      recordId: validated.recordId,
      oldHeadId: validated.revisionId,
      // New
      newHeadId: newRevisionId,
    });

    return newRevisionId;
  }

  /**
   * Create AVPs for all fields in a new record
   *
   * This iterates through the values from the form data, fetches the existing
   * AVP, checks if different based on registered equality functions, and
   * creates a new AVP if needed.
   *
   * @param params.formRecord - The validated form record data
   * @param params.revisionId - The revision ID these AVPs belong to
   * @returns Map of field names to created AVP IDs
   * @throws Error if AVP creation fails
   */
  private async createAvpsForAllFields({
    formRecord,
    revisionId,
    recordId,
  }: {
    formRecord: NewFormRecord;
    revisionId: string;
    recordId: string;
  }): Promise<Record<string, string>> {
    const avpMap: Record<string, string> = {};
    const avpsToCreate: Array<NewAvpDBDocument> = [];

    // Create AVP for each field
    for (const [fieldName, fieldValue] of Object.entries(formRecord.data)) {
      const avpId = generateAvpID();

      // Get the field type
      const fieldType = this.uiSpec.fields[fieldName]?.['type-returned'];

      const avp: NewAvpDBDocument = {
        _id: avpId,
        avp_format_version: 1,
        // TODO remove this - it's extraneous
        type: fieldType ?? UNKNOWN_TYPE_FALLBACK,
        data: fieldValue,
        revision_id: revisionId,
        record_id: recordId,
        annotations: formRecord.annotations[fieldName],
        // NOTE we may want to consider what timing to use here
        created: getCurrentTimestamp(),
        // NOTE we may want to consider who created this, updater?
        created_by: formRecord.createdBy,
      };

      avpsToCreate.push(avp);
      avpMap[fieldName] = avpId;
    }

    // Create all AVPs (with attachment handling if configured)
    await this.bulkCreateAvps(avpsToCreate);

    return avpMap;
  }

  /**
   * Create new AVPs for changed fields, reuse AVP IDs for unchanged fields.
   * This optimizes storage by only creating new AVPs when data actually changes.
   *
   * @param params.formRecord - The validated form record with changes
   * @param params.parentRevision - The parent revision to compare against
   * @param params.newRevisionId - The new revision ID being created
   * @returns Map of field names to AVP IDs (new or reused)
   * @throws Error if equality function not configured
   * @throws Error if AVP operations fail
   */
  private async createOrReuseAvps({
    formRecord,
    parentRevision,
    newRevisionId,
  }: {
    formRecord: ExistingFormRecord;
    parentRevision: ExistingRevisionDBDocument;
    newRevisionId: string;
  }): Promise<Record<string, string>> {
    if (!this.getEqualityFn) {
      throw new Error(
        'Form operations not configured. Call configure() first.'
      );
    }

    const avpMap: Record<string, string> = {};
    const avpsToCreate: Array<NewAvpDBDocument> = [];

    // Fetch all parent AVPs efficiently in parallel
    const parentAvpIds = Object.values(parentRevision.avps);
    const parentAvpPromises = parentAvpIds.map(id => this.core.getAvp(id));
    const parentAvps = await Promise.all(parentAvpPromises);

    // Build map of field name -> parent AVP
    const parentAvpsByField = new Map<string, ExistingAvpDBDocument>();
    for (const [fieldName, avpId] of Object.entries(parentRevision.avps)) {
      const avp = parentAvps.find(a => a._id === avpId);
      if (avp) {
        parentAvpsByField.set(fieldName, avp);
      }
    }

    // Check each field for changes
    for (const [fieldName, fieldValue] of Object.entries(formRecord.data)) {
      // Get the field type
      const fieldType = this.uiSpec.fields[fieldName]?.['type-returned'];
      const fieldAnnotation = formRecord.annotations[fieldName];
      const parentAvp = parentAvpsByField.get(fieldName);

      // Determine if data or annotations changed
      const equalityFn = this.getEqualityFn(fieldType);

      const hasDataChanged =
        parentAvp === undefined
          ? true
          : !(await equalityFn(parentAvp.data, fieldValue));

      // Checking annotation equality is interesting - should we consider just
      // changing the existing AVP with a new annotation?
      const hasAnnotationChanged =
        parentAvp === undefined
          ? true
          : !(await equalityFn(parentAvp.annotations, fieldAnnotation));

      if (hasDataChanged || hasAnnotationChanged) {
        // Create new AVP
        const avpId = generateAvpID();

        const avp: NewAvpDBDocument = {
          _id: avpId,
          avp_format_version: 1,
          type: fieldType,
          data: fieldValue,
          revision_id: newRevisionId,
          record_id: formRecord.recordId,
          annotations: fieldAnnotation,
          // NOTE: do we want to consider timing on a per field basis as tracked
          // in form - seems a bit overkill
          created: getCurrentTimestamp(),
          // NOTE: here we track the creator by update
          created_by: formRecord.updatedBy,
        };

        avpsToCreate.push(avp);
        avpMap[fieldName] = avpId;
      } else {
        // Reuse existing AVP ID
        avpMap[fieldName] = parentAvp!._id;
      }
    }

    // Create all new AVPs (with attachment handling if configured)
    await this.bulkCreateAvps(avpsToCreate);

    return avpMap;
  }

  /**
   * Bulk create AVPs, handling attachments if dumper is configured.
   * Uses PouchDB bulkDocs for efficient batch operations.
   *
   * @param avps - Array of AVP documents to create
   * @throws Error if bulk operation fails
   */
  private async bulkCreateAvps(avps: Array<AvpDBDocument>): Promise<void> {
    if (avps.length === 0) {
      return;
    }

    const allDocsToCreate: any[] = [];

    // Process each AVP through its attachment dumper if available
    for (const avp of avps) {
      // TODO fix this by instead providing a configurable service injection approach
      /*
      const dumper = this.getAttachmentDumper(avp.type);
      if (dumper) {
        // Dumper returns array of [avp, ...attachment_docs]
        const docs = dumper(avp);
        allDocsToCreate.push(...docs);
      } else {
        // No dumper for this type, just add the AVP
        allDocsToCreate.push(avp);
      }
      */
      allDocsToCreate.push(avp);
    }

    // Use PouchDB bulkDocs for efficiency
    const db = this.core.getDb();
    await db.bulkDocs(allDocsToCreate);
  }

  /**
   * Update Record document's heads and revisions arrays after creating new revision.
   * Removes old head, adds new head, and maintains complete revision history.
   *
   * @param params.recordId - The record ID to update
   * @param params.oldHeadId - The old head revision ID to remove
   * @param params.newHeadId - The new head revision ID to add
   * @throws Error if record update fails
   */
  private async updateRecordHeads({
    recordId,
    oldHeadId,
    newHeadId,
  }: {
    recordId: string;
    oldHeadId: string;
    newHeadId: string;
  }): Promise<void> {
    const record = await this.core.getRecord(recordId);

    // Add new head, remove old head
    const heads = new Set(record.heads);
    heads.add(newHeadId);
    heads.delete(oldHeadId);

    // Add new revision to complete history
    const revisions = new Set(record.revisions);
    revisions.add(newHeadId);

    // Sort for consistency
    const updatedRecord: ExistingRecordDBDocument = {
      ...record,
      heads: Array.from(heads).sort(),
      revisions: Array.from(revisions).sort(),
    };

    await this.core.updateRecord(updatedRecord);
  }
}
