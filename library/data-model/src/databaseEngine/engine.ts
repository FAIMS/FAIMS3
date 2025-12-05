import {v4 as uuidv4} from 'uuid';
import {isEqualFAIMS} from '../datamodel';
import {DatabaseInterface, UISpecification} from '../types';
import {getHridFieldMap, HridFieldMap} from '../uiSpecification';
import {differenceSets} from '../utils';
import * as Exceptions from './exceptions';
import {
  AvpDBDocument,
  AvpUpdateMode,
  DataDocument,
  ExistingAttachmentDBDocument,
  existingAttachmentDocumentSchema,
  ExistingAvpDBDocument,
  existingAvpDocumentSchema,
  ExistingPouchDocument,
  ExistingRecordDBDocument,
  existingRecordDocumentSchema,
  ExistingRevisionDBDocument,
  existingRevisionDocumentSchema,
  FormDataEntry,
  FormUpdateData,
  HydratedDataField,
  HydratedRecord,
  InitialFormData,
  NewAvpDBDocument,
  newAvpDocumentSchema,
  NewFormRecord,
  newFormRecordSchema,
  NewPendingAttachmentDBDocument,
  NewPouchDocument,
  NewRecordDBDocument,
  newRecordDocumentSchema,
  NewRevisionDBDocument,
  newRevisionDocumentSchema,
  pendingAttachmentDocumentSchema,
} from './types';

// =======
// HELPERS
// =======

function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

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

/**
 * A utility function to easily created mapped version of hydrated data
 * @param data The record data to map through
 * @param mapFn The function to apply to each
 * @returns The mapped data
 */
export function dataMap<T>({
  data,
  mapFn,
}: {
  data: Record<string, HydratedDataField>;
  mapFn: (data: HydratedDataField) => T;
}): Record<string, T> {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, mapFn(value)])
  );
}

// =========
// CONSTANTS
// =========

const DEFAULT_CONFLICT_BEHAVIOUR = 'pickFirst';
export const UNKNOWN_TYPE_FALLBACK = '??:??';

// ============================================================================
// Configuration Schemas and Types
// ============================================================================

type AvpStrategy =
  | 'reuse_current' // Use existing AVP from current revision
  | 'reuse_parent' // Use AVP from parent revision (revert case)
  | 'create_new' // Create a brand new AVP
  | 'update_inplace'; // Update existing AVP in-place

/**
 * Configuration options for the DataEngine
 */
export interface DataEngineConfig {
  // The name of the PouchDB database
  dataDb: DatabaseInterface<DataDocument>;
  // UI Specification related to this project
  uiSpec: UISpecification;
}

// What options for conflict?
export type ConflictBehaviour = 'throw' | 'pickFirst' | 'pickLast';

// The configuration provided when hydrating a record
export interface HydratedRecordConfig {
  conflictBehaviour: ConflictBehaviour;
}

// ===========
// DataEngine
// ===========

/**
 * Unified data engine providing typed API for all database operations. Includes
 * embedded Core, Hydrated, and Form submodules for different access patterns.
 */
export class DataEngine {
  // The PouchDB interface
  public readonly db: DatabaseInterface;

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
    this.hydrated = new HydratedOperations(this.core, this.uiSpec);
    this.form = new FormOperations(this.core, this.hydrated, this.uiSpec);
  }
}

// ============================================================================
// Core Operations - Direct Database CRUD
// ============================================================================

/**
 * Core database operations providing type-safe CRUD for all document types.
 * This is the lowest-level API for direct database access.
 */
export class CoreOperations {
  public readonly db: DatabaseInterface;

  constructor(db: DatabaseInterface) {
    this.db = db;
  }

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
    validator: (doc: unknown) => T
  ): Promise<T> {
    // Fetch doc
    let doc;
    try {
      doc = await this.db.get(id);
    } catch (err: any) {
      if (err.status === 404) {
        throw new Exceptions.DocumentNotFoundError(id);
      }
      throw err;
    }
    // Validate doc
    try {
      return validator(doc);
    } catch (e) {
      throw new Exceptions.DocumentValidationError({
        recordId: id,
        doc,
        validationErr: e,
        operation: 'get (core.getDocumentOfType)',
      });
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
  private async createDocument<T extends NewPouchDocument>(
    doc: T,
    validator: (doc: T) => T
  ): Promise<T & {_rev: string}> {
    let validated: T;

    // Validate doc
    try {
      validated = validator(doc);
    } catch (e) {
      throw new Exceptions.DocumentValidationError({
        recordId: doc._id,
        doc,
        validationErr: e,
        operation: 'create (core.createDocument)',
      });
    }

    const response = await this.db.put(validated);

    if (!response.ok) {
      throw new Error(`Failed to create document: ${response}`);
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
  private async updateDocument<T extends ExistingPouchDocument>(
    doc: T,
    validator: (doc: T) => T,
    writeOnClash = true,
    maxRetries = 5
  ): Promise<T | undefined> {
    let validated: T;

    // Validate doc
    try {
      validated = validator(doc);
    } catch (e) {
      throw new Exceptions.DocumentValidationError({
        recordId: doc._id,
        doc,
        validationErr: e,
        operation: 'update (core.updateDocument)',
      });
    }

    // Try to put directly - if no clash, succeeds immediately
    try {
      const response = await this.db.put(validated);
      if (!response.ok) {
        throw new Error(
          `Failed to update document with id ${validated._id}: ${response}`
        );
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
              const updatedDoc = validator({
                ...validated,
                _rev: existingRecord._rev,
              });
              const response = await this.db.put(updatedDoc);
              if (!response.ok) {
                throw new Error(
                  `Failed to update document with id ${updatedDoc._id}: ${response}`
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
                `Failed to update document after ${attempts} attempt(s). ` +
                  `Error: ${retryErr}`
              );
            }
          }
          // This shouldn't be reached, but just in case
          throw new Error(
            `Failed to update document after ${maxRetries} retries`
          );
        } else {
          // Conflict occurred but writeOnClash is false - return undefined
          return undefined;
        }
      } else {
        // Non-conflict error occurred - log and throw
        console.log(err);
        throw new Error(`Failed to update document - non 409 error: ${err}`);
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
    return this.getDocumentOfType(id, existingRecordDocumentSchema.parse);
  }

  /**
   * Get a revision document by ID
   *
   * @param id - The revision document ID
   * @returns The existing revision document with AVP references
   * @throws DocumentNotFoundError if revision doesn't exist
   */
  async getRevision(id: string): Promise<ExistingRevisionDBDocument> {
    return this.getDocumentOfType(id, existingRevisionDocumentSchema.parse);
  }

  /**
   * Get an AVP (Attribute-Value-Pair) document by ID
   *
   * @param id - The AVP document ID
   * @returns The existing AVP document with field data
   * @throws DocumentNotFoundError if AVP doesn't exist
   */
  async getAvp(id: string): Promise<ExistingAvpDBDocument> {
    return this.getDocumentOfType(id, existingAvpDocumentSchema.parse);
  }

  /**
   * Get an attachment document by ID
   *
   * @param id - The attachment document ID
   * @returns The existing attachment document
   * @throws DocumentNotFoundError if attachment doesn't exist
   */
  async getAttachment(id: string): Promise<ExistingAttachmentDBDocument> {
    return this.getDocumentOfType(id, existingAttachmentDocumentSchema.parse);
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
    return this.createDocument(record, newRecordDocumentSchema.parse);
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
    return this.createDocument(revision, newRevisionDocumentSchema.parse);
  }

  /**
   * Create a new AVP document
   *
   * @param avp - The AVP document to create (without _rev)
   * @returns The created AVP with _rev
   * @throws Error if creation fails
   */
  async createAvp(avp: NewAvpDBDocument): Promise<ExistingAvpDBDocument> {
    return this.createDocument(avp, newAvpDocumentSchema.parse);
  }

  /**
   * Create a new attachment document
   *
   * NOTE: this is a special case as Couch converts behind the scenes pending ->
   * attached. So you get a different object out than in.
   *
   * @param attachment - The attachment document to create (without _rev)
   * @returns The created attachment with _rev
   * @throws Error if creation fails
   */
  async createAttachment(
    attachment: NewPendingAttachmentDBDocument
  ): Promise<ExistingAttachmentDBDocument> {
    await this.createDocument(
      attachment,
      pendingAttachmentDocumentSchema.parse
    );

    // Fetch it back out to get the existing version (where it should be encoded nicely)
    return this.getAttachment(attachment._id);
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
      existingRecordDocumentSchema.parse
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
      existingRevisionDocumentSchema.parse
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
    return (await this.updateDocument(avp, existingAvpDocumentSchema.parse))!;
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
      existingAttachmentDocumentSchema.parse
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
   * Resolve which head revision to use when multiple heads exist (conflict)
   *
   * @param recordId - The record ID experiencing conflict
   * @param heads - Array of conflicting head revision IDs
   * @param behavior - Strategy for resolving conflicts
   * @returns The selected head ID and whether a conflict was detected
   * @throws NoHeadsError if heads array is empty
   * @throws RecordConflictError if behavior is 'throw' and multiple heads exist
   */
  resolveHead({
    recordId,
    heads,
    behavior,
  }: {
    recordId: string;
    heads: string[];
    behavior: ConflictBehaviour;
  }): {selectedHead: string; hadConflict: boolean} {
    if (heads.length === 0) {
      throw new Exceptions.NoHeadsError(recordId);
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
        throw new Exceptions.RecordConflictError(recordId, heads);
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
}

// ============================================================================
// Hydrated Operations - Records with Full Relationships
// ============================================================================

/**
 * Hydrated record operations that fetch records with all their relationships loaded.
 * This includes the record, its head revision, and all AVPs (field data) in a single call.
 */
class HydratedOperations {
  private readonly hridFieldMap: HridFieldMap;

  constructor(
    private readonly core: CoreOperations,
    private readonly uiSpec: UISpecification
  ) {
    this.hridFieldMap = getHridFieldMap(this.uiSpec);
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
   * @param revisionId - The revision to target (or use head according to
   * conflict resolution)
   * @param conflictBehaviour - Configuration for conflict resolution
   * @returns Hydrated record with all data and metadata
   * @throws DocumentNotFoundError if record doesn't exist
   * @throws RecordConflictError if conflict behavior is 'throw' and multiple
   * heads exist
   * @throws NoHeadsError if record has no heads
   */
  async getHydratedRecord({
    recordId,
    revisionId,
    config = {},
  }: {
    recordId: string;
    revisionId?: string;
    config?: Partial<HydratedRecordConfig>;
  }): Promise<HydratedRecord> {
    // Step 1: Fetch the record
    const record = await this.core.getRecord(recordId);

    // Step 2: Resolve which head to use
    let targetRevisionId: string | undefined = revisionId;
    let hadConflict = false;

    // Only lookup heads if needed
    if (!targetRevisionId) {
      const {selectedHead, hadConflict: conflict} = this.core.resolveHead({
        recordId,
        heads: record.heads,
        behavior: config.conflictBehaviour ?? DEFAULT_CONFLICT_BEHAVIOUR,
      });
      targetRevisionId = selectedHead;
      hadConflict = conflict;
    }

    // Step 3: Fetch the revision
    const revision = await this.core.getRevision(targetRevisionId);

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

    // Get the correct relationship data
    const relationship = revision.relationship;

    // Map to formRelationshipSchema type
    const formRelationship =
      relationship && 'parent' in relationship
        ? {
            parent: {
              recordId: relationship.parent.record_id,
              fieldId: relationship.parent.field_id,
              relationTypeVocabPair:
                relationship.parent.relation_type_vocabPair,
            },
          }
        : undefined;

    const hridFieldName = this.hridFieldMap[revision.type];
    const rawHridData = hridFieldName ? data[hridFieldName]?.data : undefined;
    let finalHrid = record._id;
    if (rawHridData) {
      if (typeof rawHridData === 'string') {
        finalHrid = rawHridData;
      }
    }

    // Step 5: Build the hydrated record (in our external interface)
    return {
      hrid: finalHrid,
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
        relationship: formRelationship,
      },
      data: mappedData,
      metadata: {
        hadConflict,
        conflictResolution: hadConflict ? config.conflictBehaviour : undefined,
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
    const promises = recordIds.map(id =>
      this.getHydratedRecord({
        recordId: id,
        config,
      })
    );
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
 * Form record operations providing high-level create/update interface. Handles
 * complex logic like change detection, AVP reuse, and attachment processing.
 */
class FormOperations {
  private readonly uiSpec: UISpecification;

  constructor(
    private readonly core: CoreOperations,
    private readonly hydrated: HydratedOperations,
    uiSpec: UISpecification
  ) {
    this.uiSpec = uiSpec;
  }

  /**
   *
   * @param recordId record Id of interest
   * @returns the current
   */
  async getCurrentRevisionId({recordId}: {recordId: string}): Promise<string> {
    const heads = await this.hydrated.getHeads(recordId);
    if (heads.length === 0) {
      throw new Exceptions.NoHeadsError(recordId);
    } else if (heads.length > 1) {
      throw new Exceptions.RecordConflictError(recordId, heads);
    }
    return heads[0];
  }

  /**
   * Create a brand new record. This does not create any AVPs/data.
   *
   * This creates
   *
   * a) Record b) Revision
   *
   * @param formRecord - Basic information about the new record to create - does
   * not include data
   * @returns The ID of the newly created revision
   * @throws Error if revision_id is not null (should use updateRecord instead)
   * @throws Error if record creation fails
   */
  async createRecord(formRecord: NewFormRecord): Promise<{
    record: ExistingRecordDBDocument;
    revision: ExistingRevisionDBDocument;
  }> {
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

    // Create the new record
    const rec = await this.core.createRecord(recordDoc);

    // Step 2: Create Revision document
    const revisionDoc: NewRevisionDBDocument = {
      _id: revisionId,
      revision_format_version: 1,
      avps: {},
      record_id: recordId,
      parents: [],
      created: getCurrentTimestamp(),
      created_by: validated.createdBy,
      type: validated.formId,
      // This is about annotating documents with issues - but is unused
      ugc_comment: '',
      // Convert back into relationship format for storage
      relationship: validated.relationship
        ? {
            parent: {
              field_id: validated.relationship.parent.fieldId,
              record_id: validated.relationship.parent.recordId,
              relation_type_vocabPair:
                validated.relationship.parent.relationTypeVocabPair,
            },
          }
        : undefined,
    };

    // Create the new revision
    const rev = await this.core.createRevision(revisionDoc);

    // Return all the new data
    return {record: rec, revision: rev};
  }

  /**
   * Creates a new revision from a previous record/revision (ensure these are
   * from the same record).
   *
   * Does NOT create any new AVPs, instead seeds this new revision with a copy
   * of previous revision AVP data.
   *
   * @param recordId The parent record ID
   * @param revisionId The parent revision (from record above)
   * @param createdBy Who is creating this new revision?
   * @returns The new revision DB document
   */
  async createRevision({
    recordId,
    revisionId,
    createdBy,
  }: {
    recordId: string;
    revisionId: string;
    createdBy: string;
  }): Promise<ExistingRevisionDBDocument> {
    // Fetch the revision
    const parentRevision = await this.core.getRevision(revisionId);

    // Check that the revision record ID matches
    if (parentRevision.record_id !== recordId) {
      throw new Exceptions.RevisionMismatchError(recordId, revisionId);
    }

    // Generate a new revision ID
    const childRevisionId = generateRevisionID();

    // Creates a new revision
    const newRevision = await this.core.createRevision({
      _id: childRevisionId,
      avps: parentRevision.avps,
      created: getCurrentTimestamp(),
      created_by: createdBy,
      // Mark the parent revision ID as the parent
      parents: [revisionId],
      record_id: recordId,
      revision_format_version: 1,
      type: parentRevision.type,
      relationship: parentRevision.relationship,
      ugc_comment: parentRevision.ugc_comment,
    });

    // Now go and update the record to indicate the new head
    await this.updateRecordHeads({
      recordId,
      oldHeadId: revisionId,
      newHeadId: childRevisionId,
    });

    // All done
    return newRevision;
  }

  /**
   * Updates a revision by creating or reusing AVPs for changed fields. Updates
   * revision document only if AVPs have changed.
   *
   * mode = new - update inplace AVPs where possible, otherwise create new ones.
   * Requires that parents be empty/undefined on the revision, or will throw an
   * error.
   *
   * mode = parent - same as new, except if the parent AVP equals child AVP,
   * then a new AVP is created, rather than inplace updating. Subsequent updates
   * may be inplace. Requires that parents have a singular entry, or error is
   * thrown.
   *
   * @param revisionId - The revision to update
   * @param recordId - The parent record ID
   * @param update - Form data changes to apply
   * @param mode - AVP update mode: 'parent' (requires single parent) or 'new'
   * (no parents)
   * @param updatedBy - User identifier making the changes
   * @param config - Optional hydration config with conflict behavior
   *
   * @returns The updated or unchanged revision document
   *
   * @throws {MalformedParentsError} If parent requirements don't match the mode
   */
  async updateRevision({
    revisionId,
    recordId,
    update,
    mode,
    updatedBy,
    config = {conflictBehaviour: DEFAULT_CONFLICT_BEHAVIOUR},
  }: {
    revisionId: string;
    recordId: string;
    update: FormUpdateData;
    mode: AvpUpdateMode;
    updatedBy: string;
    config?: HydratedRecordConfig;
  }): Promise<ExistingRevisionDBDocument> {
    // Step 1: Fetch the current revision
    const currentRevision = await this.core.getRevision(revisionId);

    // What parents does the revision have?
    const parents = currentRevision.parents;
    let parentRevisionId: string | undefined = undefined;

    // Step 2: Check parent integrity
    if (mode === 'parent') {
      if (!parents) {
        throw new Exceptions.MalformedParentsError(
          recordId,
          revisionId,
          'Parents array not present on revision where parent mode requested.'
        );
      } else if (parents.length !== 1) {
        throw new Exceptions.MalformedParentsError(
          recordId,
          revisionId,
          'Parent mode for updating a revision requires exactly one parent to be present.'
        );
      }
      // Get the first entry in the parents array
      parentRevisionId = parents[0];
    } else if (mode === 'new') {
      if (parents && parents.length > 0) {
        throw new Exceptions.MalformedParentsError(
          recordId,
          revisionId,
          'You have requested new updateRevision mode which is used for new records only - you have a parent. Erroneous AVP behaviour is likely.'
        );
      }
    }
    const parentRevision = parentRevisionId
      ? await this.core.getRevision(parentRevisionId)
      : undefined;

    // Step 2: Determine which AVPs need to be created (changed fields)
    const {avpMap, changeDetected} = await this.createOrReuseAvps({
      config,
      currentRevision,
      newData: update,
      updatedBy,
      parentRevision,
    });

    // This may have created new AVPs, or removed them - is there any change?
    if (changeDetected) {
      // Change detected, create new revision
      const revisionDoc: ExistingRevisionDBDocument = {
        // Change AVP map
        avps: avpMap,
        // Everythinge else inherited
        _id: currentRevision._id,
        _rev: currentRevision._rev,
        revision_format_version: currentRevision.revision_format_version,
        record_id: currentRevision.record_id,
        parents: currentRevision.parents,
        created: currentRevision.created,
        created_by: currentRevision.created_by,
        type: currentRevision.type,
        ugc_comment: currentRevision.ugc_comment,
        relationship: currentRevision.relationship,
      };
      return await this.core.updateRevision(revisionDoc);
    } else {
      // no change needed (at revision level)
      return currentRevision;
    }
  }

  /**
   * Given a record ID, and optionally a revision ID, gets the hydrated data,
   * then maps it into the existing form data format. This is a nice utility
   * function for loading data into a form for updated existing records in the
   * app.  Also included are the revision ID and the form ID which are needed
   * to set up the form.
   *
   * @param recordId The record
   * @param revisionId The revision if using specific one, otherwise head
   * according to hydration config
   * @param config The settings for hydration
   * @returns The ready to go existing form data + revision/form IDs
   */
  async getExistingFormData({
    recordId,
    revisionId,
    config = {},
  }: {
    recordId: string;
    revisionId?: string;
    config?: Partial<HydratedRecordConfig>;
  }): Promise<InitialFormData> {
    // Grab the hydrated version
    const hydrated = await this.hydrated.getHydratedRecord({
      recordId,
      revisionId,
      config,
    });

    const data = dataMap({
      data: hydrated.data,
      mapFn: d => ({
        annotation: d.annotations,
        attachments: d.faimsAttachments,
        data: d.data,
      }),
    });

    return {
      revisionId: hydrated.revision._id,
      formId: hydrated.record.formId,
      data,
      // Additional context
      context: {
        record: hydrated.record,
        revision: hydrated.revision,
        hrid: hydrated.hrid,
      },
    };
  }

  /**
   * Create new AVPs for changed fields, reuse AVP IDs for unchanged fields.
   * This optimizes storage by only creating new AVPs when data actually changes.
   *
   * @param params.formRecord - The validated form record with changes
   * @param params.parentRevision - The parent revision to compare against
   * @param params.newRevisionId - The new revision ID being created
   * @param params.updatedBy - Who updated - this is marked as creator of AVP
   * @returns Map of field names to AVP IDs (new or reused)
   * @throws Error if equality function not configured
   * @throws Error if AVP operations fail
   */
  private async createOrReuseAvps({
    currentRevision,
    newData,
    parentRevision,
    updatedBy,
    config,
  }: {
    newData: FormUpdateData;
    currentRevision: ExistingRevisionDBDocument;
    parentRevision?: ExistingRevisionDBDocument;
    updatedBy: string;
    config: HydratedRecordConfig;
  }): Promise<{avpMap: Record<string, string>; changeDetected: boolean}> {
    // ===== Setup: Fetch hydrated data and prepare comparison structures =====

    const {current, parent} = await this.fetchHydratedData(
      currentRevision,
      parentRevision,
      config
    );

    // These types of strategies flag a change
    const changeStrategies: AvpStrategy[] = ['create_new', 'reuse_parent'];

    // ===== Process each field and determine AVP strategy =====

    const avpsToCreate: Array<NewAvpDBDocument> = [];
    const avpsToUpdate: Array<ExistingAvpDBDocument> = [];
    const outputAvpMap: Record<string, string> = {};
    let changeDetected = false;

    for (const [fieldname, newFieldData] of Object.entries(newData)) {
      const strategy = await this.determineAvpStrategy({
        fieldname,
        newFieldData,
        current,
        parent,
        currentRevision,
        parentRevision,
      });

      // change check
      if (changeStrategies.includes(strategy)) {
        changeDetected = true;
      }

      await this.applyAvpStrategy({
        strategy,
        fieldname,
        newFieldData,
        currentRevision,
        parentRevision,
        updatedBy,
        avpsToCreate,
        avpsToUpdate,
        outputAvpMap,
      });
    }

    // ===== Persist all AVP changes =====

    await this.bulkPutAvps(avpsToCreate);
    await this.bulkPutAvps(avpsToUpdate);

    // Updating inplace AVPs doesn't necessarily, however we may have a
    // situation where we removed data completely - check for missing keys from
    // the prior data
    if (!changeDetected) {
      // Build sets of the old/new keys
      const oldKeys = new Set(Object.keys(currentRevision.avps));
      const newKeys = new Set(Object.keys(newData));

      if (differenceSets(oldKeys, newKeys).size > 0) {
        // There is a field in the old data no longer in the new data
        changeDetected = true;
      }
    }

    return {avpMap: outputAvpMap, changeDetected};
  }

  /**
   * Fetch and hydrate both current and parent revisions, extracting their data
   * into a comparable format.
   */
  private async fetchHydratedData(
    currentRevision: ExistingRevisionDBDocument,
    parentRevision: ExistingRevisionDBDocument | undefined,
    config: HydratedRecordConfig
  ) {
    const currentRevisionHydrated = await this.hydrated.getHydratedRecord({
      recordId: currentRevision.record_id,
      revisionId: currentRevision._id,
      config,
    });

    const parentRevisionHydrated = parentRevision
      ? await this.hydrated.getHydratedRecord({
          recordId: parentRevision.record_id,
          revisionId: parentRevision._id,
          config,
        })
      : undefined;

    const current = this.extractComparableData(currentRevisionHydrated);
    const parent = parentRevisionHydrated
      ? this.extractComparableData(parentRevisionHydrated)
      : undefined;

    return {current, parent};
  }

  /**
   * Extract data, annotations, and attachments into a comparable format.
   */
  private extractComparableData(
    hydratedRecord: any
  ): Record<string, FormDataEntry> {
    return dataMap({
      data: hydratedRecord.data,
      mapFn: d => ({
        data: d.data,
        annotation: d.annotations,
        attachments: d.faimsAttachments,
      }),
    });
  }

  /**
   * Determine the appropriate AVP strategy for a field based on comparing
   * new data against current and parent revisions.
   */
  private async determineAvpStrategy({
    fieldname,
    newFieldData,
    current,
    parent,
    currentRevision,
    parentRevision,
  }: {
    fieldname: string;
    newFieldData: FormDataEntry;
    current: Record<string, FormDataEntry>;
    parent?: Record<string, FormDataEntry>;
    currentRevision: ExistingRevisionDBDocument;
    parentRevision?: ExistingRevisionDBDocument;
  }): Promise<AvpStrategy> {
    const existsInCurrent = fieldname in current;
    const existsInParent = parent && fieldname in parent;

    // Case 1: Field is new (not in current revision)
    if (!existsInCurrent) {
      return this.handleNewField(
        newFieldData,
        existsInParent ? parent[fieldname] : undefined
      );
    }

    // Case 2: Field exists in current revision
    const currentFieldData = current[fieldname];
    const hasChanged = !(await this.isEqualFormData(
      currentFieldData,
      newFieldData
    ));

    if (!hasChanged) {
      // Field unchanged - reuse existing AVP
      return 'reuse_current';
    }

    // Field has changed - determine how to handle the change
    return this.handleChangedField({
      newFieldData,
      currentRevision,
      parentRevision,
      parentFieldData: existsInParent ? parent[fieldname] : undefined,
      fieldname,
    });
  }

  /**
   * Determine strategy for a field that doesn't exist in the current revision.
   */
  private async handleNewField(
    newFieldData: FormDataEntry,
    parentFieldData?: FormDataEntry
  ): Promise<AvpStrategy> {
    // If no parent or field doesn't exist in parent, create new AVP
    if (!parentFieldData) {
      return 'create_new';
    }

    // If parent has identical data, reuse parent's AVP (user is "reverting")
    if (await this.isEqualFormData(parentFieldData, newFieldData)) {
      return 'reuse_parent';
    }

    // Parent has different data, create new AVP
    return 'create_new';
  }

  /**
   * Determine strategy for a field that exists in current revision but has changed.
   */
  private async handleChangedField({
    newFieldData,
    currentRevision,
    parentRevision,
    parentFieldData,
    fieldname,
  }: {
    newFieldData: FormDataEntry;
    currentRevision: ExistingRevisionDBDocument;
    parentRevision?: ExistingRevisionDBDocument;
    parentFieldData?: FormDataEntry;
    fieldname: string;
  }): Promise<AvpStrategy> {
    // If new data matches parent, reuse parent's AVP (user is "reverting")
    if (
      parentFieldData &&
      (await this.isEqualFormData(parentFieldData, newFieldData))
    ) {
      return 'reuse_parent';
    }

    // Determine if we need a new AVP or can update in-place
    const shouldCreateNew = await this.shouldCreateNewAvp(
      currentRevision,
      parentRevision,
      fieldname
    );

    if (shouldCreateNew) {
      return 'create_new';
    } else {
      return 'update_inplace';
    }
  }

  /**
   * Determine if we should create a new AVP or update the existing one in-place.
   *
   * We create a new AVP when:
   * - There's no parent revision (first edit), OR
   * - The current AVP ID matches the parent's AVP ID (not yet diverged)
   *
   * We update in-place when:
   * - The current AVP ID differs from parent's (already diverged in a previous edit)
   */
  private async shouldCreateNewAvp(
    currentRevision: ExistingRevisionDBDocument,
    parentRevision: ExistingRevisionDBDocument | undefined,
    fieldname: string
  ): Promise<boolean> {
    if (!parentRevision) {
      // No parent - we can update in-place
      return false;
    }

    const currentAvpId = currentRevision.avps[fieldname];
    const parentAvpId = parentRevision.avps[fieldname];

    // If AVP IDs match, this is the first divergence - create new AVP
    // If AVP IDs differ, we've already diverged - update in-place
    return currentAvpId === parentAvpId;
  }

  /**
   * Apply the determined AVP strategy, updating the appropriate collections.
   */
  private async applyAvpStrategy({
    strategy,
    fieldname,
    newFieldData,
    currentRevision,
    parentRevision,
    updatedBy,
    avpsToCreate,
    avpsToUpdate,
    outputAvpMap,
  }: {
    strategy: AvpStrategy;
    fieldname: string;
    newFieldData: FormDataEntry;
    currentRevision: ExistingRevisionDBDocument;
    parentRevision?: ExistingRevisionDBDocument;
    updatedBy: string;
    avpsToCreate: Array<NewAvpDBDocument>;
    avpsToUpdate: Array<ExistingAvpDBDocument>;
    outputAvpMap: Record<string, string>;
  }) {
    if (strategy === 'reuse_current') {
      // No changes needed, just reference the existing AVP
      outputAvpMap[fieldname] = currentRevision.avps[fieldname];
    } else if (strategy === 'reuse_parent') {
      if (!parentRevision) {
        throw new Error(
          'Cannot apply the reuse_parent AVP strategy when parentRevision is not provided.'
        );
      }
      // Reference the parent's AVP (user reverted to previous version)
      outputAvpMap[fieldname] = parentRevision.avps[fieldname];
    } else if (strategy === 'create_new') {
      // Create a new AVP document
      const newAvp = this.buildNewAvp(
        fieldname,
        newFieldData,
        currentRevision,
        updatedBy
      );
      avpsToCreate.push(newAvp);
      outputAvpMap[fieldname] = newAvp._id;
    } else if (strategy === 'update_inplace') {
      // Update existing AVP in-place
      const currentAvpId = currentRevision.avps[fieldname];
      const updatedAvp = await this.buildUpdatedAvp(currentAvpId, newFieldData);
      avpsToUpdate.push(updatedAvp);
      outputAvpMap[fieldname] = currentAvpId;
    }
  }

  /**
   * Build a new AVP document.
   */
  private buildNewAvp(
    fieldname: string,
    data: FormDataEntry,
    currentRevision: ExistingRevisionDBDocument,
    updatedBy: string
  ): NewAvpDBDocument {
    const fieldType =
      this.uiSpec.fields[fieldname]?.['type-returned'] ?? UNKNOWN_TYPE_FALLBACK;

    return {
      _id: generateAvpID(),
      avp_format_version: 1,
      created: getCurrentTimestamp(),
      created_by: updatedBy,
      record_id: currentRevision.record_id,
      revision_id: currentRevision._id,
      type: fieldType,
      annotations: data.annotation,
      data: data.data,
      faims_attachments: data.attachments?.map(a => ({
        filename: a.filename,
        attachment_id: a.attachmentId,
        file_type: a.fileType,
      })),
    };
  }

  /**
   * Build an updated AVP document (fetches existing and applies changes).
   */
  private async buildUpdatedAvp(
    avpId: string,
    newData: FormDataEntry
  ): Promise<ExistingAvpDBDocument> {
    const currentAvp = await this.core.getAvp(avpId);

    return {
      ...currentAvp,
      annotations: newData.annotation,
      data: newData.data,
      faims_attachments: newData.attachments?.map(a => ({
        attachment_id: a.attachmentId,
        file_type: a.fileType,
        filename: a.filename,
      })),
    };
  }

  /**
   * Compare two FormDataEntry objects for equality.
   */
  private async isEqualFormData(
    a: FormDataEntry,
    b: FormDataEntry
  ): Promise<boolean> {
    return (
      (await isEqualFAIMS(a.data, b.data)) &&
      (await isEqualFAIMS(a.annotation, b.annotation)) &&
      (await isEqualFAIMS(a.attachments, b.attachments))
    );
  }

  /**
   * Bulk create AVPs
   *
   * @param avps - Array of AVP documents to create
   * @throws Error if bulk operation fails
   */
  private async bulkPutAvps(avps: Array<AvpDBDocument>): Promise<void> {
    if (avps.length === 0) {
      return;
    }

    // Use PouchDB bulkDocs for efficiency
    const db = this.core.db;
    await db.bulkDocs(avps);
  }

  /**
   * Update Record document's heads and revisions arrays after creating new
   * revision. Removes old head, adds new head, and maintains complete revision
   * history.
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
