import {v4 as uuidv4} from 'uuid';
import {isEqualFAIMS} from '../datamodel';
import {DatabaseInterface, UISpecification} from '../types';
import * as Exceptions from './exceptions';
import {
  AvpDBDocument,
  AvpUpdateMode,
  DataDocument,
  ExistingAttachmentDBDocument,
  existingAttachmentDocumentSchema,
  ExistingAvpDBDocument,
  existingAvpDocumentSchema,
  ExistingFormRecord,
  ExistingPouchDocument,
  ExistingRecordDBDocument,
  existingRecordDocumentSchema,
  ExistingRevisionDBDocument,
  existingRevisionDocumentSchema,
  FaimsFormData,
  FormAnnotations,
  FormDataEntry,
  FormUpdateData,
  HydratedDataField,
  HydratedRecord,
  NewAvpDBDocument,
  newAvpDocumentSchema,
  NewFormRecord,
  newFormRecordSchema,
  NewPendingAttachmentDBDocument,
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
    this.hydrated = new HydratedOperations(this.core);
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
    try {
      const doc = await this.db.get(id);
      return validator(doc);
    } catch (err: any) {
      if (err.status === 404) {
        throw new Exceptions.DocumentNotFoundError(id);
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
  private async createDocument<T extends {}>(
    doc: T,
    validator: (doc: T) => T
  ): Promise<T & {_rev: string}> {
    const validated = validator(doc);
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
    // Validate
    const validated = validator(doc);

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
  constructor(private readonly core: CoreOperations) {}

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
   * Create a brand new record from form data.
   *
   * The input here is the form data which the app currently produces.
   *
   * This creates
   *
   * a) Record
   * b) Revision
   * c) (optional) new AVPs for each entry in data array
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

    // Step 2: Create AVPs for all fields (if data provided)
    const avpMap = validated.data
      ? await this.createAvpsForAllFields({
          formRecord: validated,
          revisionId,
          recordId,
        })
      : {};

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

    await this.core.createRevision(revisionDoc);

    return revisionId;
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
   *
   */
  async updateRevision({
    revisionId,
    recordId,
    update,
    mode,
    updatedBy,
  }: {
    // The revision to target
    revisionId: string;
    recordId: string;

    // The changes to make
    update: FormUpdateData;

    // The AVP update mode
    mode: AvpUpdateMode;

    // Who is doing the updates?
    updatedBy: string;
  }): Promise<ExistingRevisionDBDocument> {
    // Step 1: Fetch the current revision
    const currentRevision = await this.core.getRevision(revisionId);

    // What parents does the revision have?
    const parents = currentRevision.parents;

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
    } else if (mode === 'new') {
      if (parents && parents.length > 0) {
        throw new Exceptions.MalformedParentsError(
          recordId,
          revisionId,
          'You have requested new updateRevision mode which is used for new records only - you have a parent. Erroneous AVP behaviour is likely.'
        );
      }
    }

    // Step 2: Determine which AVPs need to be created (changed fields)
    const avpMap = await this.createOrReuseAvps({
      formRecord: validated,
      parentRevision,
      newRevisionId,
      updatedBy: options.updatedBy,
    });

    // Step 3: Create new Revision document
    const revisionDoc: NewRevisionDBDocument = {
      _id: newRevisionId,
      revision_format_version: 1,
      avps: avpMap,
      record_id: validated.recordId,
      parents: [validated.revisionId],
      created: getCurrentTimestamp(),
      created_by: options.updatedBy,
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
   * Given a record ID, and optionally a revision ID, gets the hydrated data,
   * then maps it into the existing form record format. This is a nice utility
   * function for loading data into a form for updated existing records in the
   * app.
   *
   * @param recordId The record
   * @param revisionId The revision if using specific one, otherwise head
   * according to hydration config
   * @param config The settings for hydration
   * @returns The ready to go existing form record
   */
  async getExistingFormRecord({
    recordId,
    revisionId,
    config = {},
  }: {
    recordId: string;
    revisionId?: string;
    config?: Partial<HydratedRecordConfig>;
  }): Promise<ExistingFormRecord> {
    // Grab the hydrated version
    const hydrated = await this.hydrated.getHydratedRecord({
      recordId,
      revisionId,
      config,
    });
    const record = hydrated.record;
    const revision = hydrated.revision;

    // Package this up into an existing form record
    return {
      recordId,
      createdBy: record.createdBy,
      revisionId: revision._id,
      formId: record.formId,
      relationship: revision.relationship,
      data: dataMap({
        data: hydrated.data,
        mapFn: d => d.data,
      }),
      annotations: dataMap({
        data: hydrated.data,
        mapFn: d => d.annotations,
      }),
    } satisfies ExistingFormRecord;
  }

  /**
   * Returns a filtered (unordered) set of new AVPs to make if either
   * a) the new data key is not present in the old data key
   * b) the data is present in both, but changed
   *
   * @param oldData Old data
   * @param newData New data
   * @returns The set of AVPs to create, indexed from new data keys
   */
  private async dataDiff(
    oldData: FaimsFormData,
    newData: FaimsFormData
  ): Promise<string[]> {
    const oldSet = new Set(Object.keys(oldData));
    const newSet = new Set(Object.keys(newData));
    const updates: Set<string> = new Set([]);

    for (const newKey of newSet) {
      if (!oldSet.has(newKey)) {
        // New - not in old data
        updates.add(newKey);
      } else {
        // Present in both - is it changed?
        if (!(await isEqualFAIMS(newData, oldData))) {
          updates.add(newKey);
        }
      }
    }

    return Array.from(updates);
  }

  /**
   * Returns a filtered (unordered) set of new AVPs to make if either
   * a) the new annotation key is not present in the old annotation key
   * b) the annotation is present in both, but changed
   *
   * @param oldAnnotations Old annotations
   * @param newAnnotations New annotations
   * @returns The set of AVPs to create, indexed from new data keys
   */
  private async annotationDiff(
    oldData: FormAnnotations,
    newData: FormAnnotations
  ): Promise<string[]> {
    const oldSet = new Set(Object.keys(oldData));
    const newSet = new Set(Object.keys(newData));
    const updates: Set<string> = new Set([]);

    for (const newKey of newSet) {
      if (!oldSet.has(newKey)) {
        // New - not in old data
        updates.add(newKey);
      } else {
        // Present in both - is it changed?
        if (!(await isEqualFAIMS(newData, oldData))) {
          updates.add(newKey);
        }
      }
    }

    return Array.from(updates);
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
    newAnnotations,
    parentRevision,
    updatedBy,
    config,
  }: {
    newData: FormUpdateData;
    newAnnotations: FormAnnotations;
    currentRevision: ExistingRevisionDBDocument;
    parentRevision?: ExistingRevisionDBDocument;
    updatedBy: string;
    config: HydratedRecordConfig;
  }): Promise<Record<string, string>> {
    // Helper function to build new AVPs
    const buildAvp = (fieldname: string, data: FormDataEntry) => {
      const fieldType = this.uiSpec.fields[fieldname]?.['type-returned'];
      return {
        _id: generateAvpID(),
        avp_format_version: 1,
        created: getCurrentTimestamp(),
        created_by: updatedBy,
        record_id: currentRevision.record_id,
        revision_id: currentRevision._id,
        // This is the type of the data in the uiSpec
        type: fieldType,
        // data, annotations, attachments
        annotations: data.annotation,
        data: data.data,
        faims_attachments: data.attachments?.map(a => ({
          filename: a.filename,
          attachment_id: a.attachmentId,
          file_type: a.fileType,
        })),
      };
    };

    // Helper function for comparisons
    const isEqual = async (
      a: FormDataEntry,
      b: FormDataEntry
    ): Promise<boolean> => {
      return (
        (await isEqualFAIMS(a.data, b.data)) &&
        (await isEqualFAIMS(a.annotation, b.annotation)) &&
        (await isEqualFAIMS(a.attachments, b.attachments))
      );
    };

    // Fetch current and parent hydrated revisions
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

    // Extract data and annotations etc
    const current = dataMap({
      data: currentRevisionHydrated.data,
      mapFn: d => ({
        data: d.data,
        annotation: d.annotations,
        attachments: d.faimsAttachments,
      }),
    });
    const parent = parentRevisionHydrated
      ? dataMap({
          data: parentRevisionHydrated.data,
          mapFn: d => ({
            data: d.data,
            annotation: d.annotations,
            attachments: d.faimsAttachments,
          }),
        })
      : undefined;

    // Did we detect a change
    let changeDetected = false;
    // New AVPs to create
    const avpsToCreate: Array<NewAvpDBDocument> = [];
    // In-place updates to make
    const avpsToUpdate: Array<ExistingAvpDBDocument> = [];
    // Resulting output AVP map to update
    const outputAvpMap: Record<string, string> = {};

    // Iterate through the new data
    for (const [fieldname, data] of Object.entries(newData)) {
      // If the new data is not in the old data, then we check if we want to
      // restore from parent, or just create new
      if (!Object.keys(current).includes(fieldname)) {
        if (parent) {
          // We have a parent, so check if it's data is equivalent
          const parentField = parent[fieldname];
          // Present on parent
          if (parentField) {
            if (await isEqual(parentField, data)) {
              // The parent already has an identical AVP - this represents
              // 'reverting' to the previous version - so we can reuse it!
              outputAvpMap[fieldname] = parentRevision?.avps[fieldname]!;
              changeDetected = true;
            } else {
              // This is the case where the old data has a non-equal AVP for a
              // new field - just create new one
              const newAvp = buildAvp(fieldname, data);
              avpsToCreate.push(newAvp);
              outputAvpMap[fieldname] = newAvp._id;
              changeDetected = true;
            }
          } else {
            // New field, not present on parent
            const newAvp = buildAvp(fieldname, data);
            avpsToCreate.push(newAvp);
            outputAvpMap[fieldname] = newAvp._id;
            changeDetected = true;
          }
        } else {
          // There is no parent - create
          const newAvp = buildAvp(fieldname, data);
          avpsToCreate.push(newAvp);
          outputAvpMap[fieldname] = newAvp._id;
          changeDetected = true;
        }
      } else {
        // This is the case where the current record already has this field
        const currentData = current[fieldname];

        // Firstly, has it changed?
        if (await isEqual(currentData, data)) {
          // It has not changed - we have a hit!
          outputAvpMap[fieldname] = currentRevision.avps[fieldname];
        } else {
          // It has changed

          // Do we have a parent?
          if (parent) {
            // Does the parent have this record?
            const parentField = parent[fieldname];
            if (parentField) {
              if (await isEqual(parentField, data)) {
                // The parent already has an identical AVP - this represents
                // 'reverting' to the previous version - so we can reuse it!
                outputAvpMap[fieldname] = parentRevision?.avps[fieldname]!;
                changeDetected = true;
              } else {
                // The parent does have this record, but it has changed from
                // then - now check if the AVPs for this field match
                if (
                  currentRevision.avps[fieldname] ===
                  parentRevision?.avps[fieldname]
                ) {
                  // This means the current has not already been updated with a
                  // new AVP - lets create one
                  const newAvp = buildAvp(fieldname, data);
                  avpsToCreate.push(newAvp);
                  outputAvpMap[fieldname] = newAvp._id;
                  changeDetected = true;
                } else {
                  // This means that the current record has previously changed
                  // from the parent and created a new AVP, so we inplace update
                  // the new AVP. NOTE this doesn't warrant a change in the
                  // revision!
                  outputAvpMap[fieldname] = currentRevision.avps[fieldname];
                  const newAvp = buildAvp(fieldname, data);
                  // TODO get the _rev
                  newAvp._rev = currentRevision.avps[fieldname];
                  avpsToUpdate.push(buildAvp(fieldname, data));
                }
              }
            } else {
              // The parent doesn't have this - and we have changed, so we
              // create new
              avpsToCreate.push(buildAvp(data));
              changeDetected = true;
            }
          } else {
            // There is no parent, and we have changed, so we have to create a new one
            avpsToCreate.push(buildAvp(data));
            changeDetected = true;
          }
        }
      }
    }

    // Check each field for changes
    for (const [fieldName, fieldValue] of Object.entries(formRecord.data)) {
      // Get the field type
      const fieldType = this.uiSpec.fields[fieldName]?.['type-returned'];
      const fieldAnnotation = formRecord.annotations[fieldName];
      const parentAvp = parentAvpsByField.get(fieldName);

      const equalityFn = isEqualFAIMS;

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
          created_by: updatedBy,
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
   * Bulk create AVPs, handling attachments if dumper is configured. Uses
   * PouchDB bulkDocs for efficient batch operations.
   *
   * NOTE: this operation does not 'dump' attachments - i.e. it does not manage
   * attachments in any way. The /app layer should use the configured attachment
   * service.
   *
   * @param avps - Array of AVP documents to create
   * @throws Error if bulk operation fails
   */
  private async bulkCreateAvps(avps: Array<AvpDBDocument>): Promise<void> {
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
