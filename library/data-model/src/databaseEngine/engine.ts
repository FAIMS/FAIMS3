import PouchDB from 'pouchdb';
import {v4 as uuidv4} from 'uuid';
import {z} from 'zod';
import {
  AttachmentDBDocument,
  AvpDBDocument,
  ExistingAttachmentDBDocument,
  ExistingAvpDBDocument,
  existingAvpDocumentSchema,
  ExistingRecordDBDocument,
  existingRecordDocumentSchema,
  ExistingRevisionDBDocument,
  existingRevisionDocumentSchema,
  getDocumentType,
  isExistingAttachmentDocument,
  isExistingAvpDocument,
  isExistingRecordDocument,
  isExistingRevisionDocument,
  RecordDBDocument,
  RevisionDBDocument,
  validateExistingAttachmentDocument,
  validateExistingAvpDocument,
  validateExistingRecordDocument,
  validateExistingRevisionDocument,
} from './types';

/**
 * Configuration options for the DataEngine
 */
export interface DataEngineConfig {
  dbName: string;
  projectId: string;
  pouchConfig?: PouchDB.Configuration.DatabaseConfiguration;
}

/**
 * Error thrown when a document is not found
 */
export class DocumentNotFoundError extends Error {
  constructor(id: string, type: string) {
    super(`${type} document with id "${id}" not found`);
    this.name = 'DocumentNotFoundError';
  }
}

/**
 * Error thrown when a document has an invalid type
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
 * Document type metadata for operations
 */
type DocumentTypeConfig<T> = {
  typeName: string;
  typeGuard: (doc: unknown) => boolean;
  validator: (doc: unknown) => T;
};

/**
 * PouchDB Data Engine - Provides a typed, ergonomic API for data operations
 */
export class DataEngine {
  private db: PouchDB.Database;
  private projectId: string;

  // Type configurations for each document type
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

  constructor(config: DataEngineConfig) {
    this.db = new PouchDB(config.dbName, config.pouchConfig);
    this.projectId = config.projectId;
  }

  // ============================================================================
  // Generic Helper Methods
  // ============================================================================

  /**
   * Generic get operation with type checking and validation
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
   */
  private async createDocument<T extends {_id: string}>(
    doc: Omit<T, '_rev'>,
    config: DocumentTypeConfig<T>
  ): Promise<T & {_rev: string}> {
    const validated = config.validator(doc) as T;
    const response = await this.db.put(validated);

    if (!response.ok) {
      throw new Error(`Failed to create ${config.typeName}: ${response}`);
    }

    return {
      ...validated,
      _rev: response.rev,
    } as T & {_rev: string};
  }

  /**
   * Generic update operation with validation
   */
  private async updateDocument<T extends {_id: string; _rev: string}>(
    doc: T,
    config: DocumentTypeConfig<T>
  ): Promise<T> {
    const validated = config.validator(doc) as T;
    const response = await this.db.put(validated);

    if (!response.ok) {
      throw new Error(`Failed to update ${config.typeName}: ${response}`);
    }

    return {
      ...validated,
      _rev: response.rev,
    } as T;
  }

  // ============================================================================
  // GET Operations
  // ============================================================================

  /**
   * Get a record document by ID
   */
  async getRecord(id: string): Promise<ExistingRecordDBDocument> {
    return this.getDocumentOfType(id, DataEngine.TYPE_CONFIGS.record);
  }

  /**
   * Get a revision document by ID
   */
  async getRevision(id: string): Promise<ExistingRevisionDBDocument> {
    return this.getDocumentOfType(id, DataEngine.TYPE_CONFIGS.revision);
  }

  /**
   * Get an AVP document by ID
   */
  async getAvp(id: string): Promise<ExistingAvpDBDocument> {
    return this.getDocumentOfType(id, DataEngine.TYPE_CONFIGS.avp);
  }

  /**
   * Get an attachment document by ID
   */
  async getAttachment(id: string): Promise<ExistingAttachmentDBDocument> {
    return this.getDocumentOfType(id, DataEngine.TYPE_CONFIGS.attachment);
  }

  // ============================================================================
  // CREATE Operations
  // ============================================================================

  /**
   * Create a new record document
   */
  async createRecord(
    record: Omit<RecordDBDocument, '_rev'>
  ): Promise<ExistingRecordDBDocument> {
    return this.createDocument(record, DataEngine.TYPE_CONFIGS.record);
  }

  /**
   * Create a new revision document
   */
  async createRevision(
    revision: Omit<RevisionDBDocument, '_rev'>
  ): Promise<ExistingRevisionDBDocument> {
    return this.createDocument(revision, DataEngine.TYPE_CONFIGS.revision);
  }

  /**
   * Create a new AVP document
   */
  async createAvp(
    avp: Omit<AvpDBDocument, '_rev'>
  ): Promise<ExistingAvpDBDocument> {
    return this.createDocument(avp, DataEngine.TYPE_CONFIGS.avp);
  }

  /**
   * Create a new attachment document
   */
  async createAttachment(
    attachment: Omit<AttachmentDBDocument, '_rev'>
  ): Promise<ExistingAttachmentDBDocument> {
    return this.createDocument(attachment, DataEngine.TYPE_CONFIGS.attachment);
  }

  // ============================================================================
  // UPDATE Operations
  // ============================================================================

  /**
   * Update an existing record document
   */
  async updateRecord(
    record: ExistingRecordDBDocument
  ): Promise<ExistingRecordDBDocument> {
    return this.updateDocument(record, DataEngine.TYPE_CONFIGS.record);
  }

  /**
   * Update an existing revision document
   */
  async updateRevision(
    revision: ExistingRevisionDBDocument
  ): Promise<ExistingRevisionDBDocument> {
    return this.updateDocument(revision, DataEngine.TYPE_CONFIGS.revision);
  }

  /**
   * Update an existing AVP document
   */
  async updateAvp(avp: ExistingAvpDBDocument): Promise<ExistingAvpDBDocument> {
    return this.updateDocument(avp, DataEngine.TYPE_CONFIGS.avp);
  }

  /**
   * Update an existing attachment document
   */
  async updateAttachment(
    attachment: ExistingAttachmentDBDocument
  ): Promise<ExistingAttachmentDBDocument> {
    return this.updateDocument(attachment, DataEngine.TYPE_CONFIGS.attachment);
  }

  // ============================================================================
  // DELETE Operations
  // ============================================================================

  /**
   * Delete a document by ID and revision
   */
  async deleteDocument(id: string, rev: string): Promise<void> {
    const response = await this.db.remove(id, rev);

    if (!response.ok) {
      throw new Error(`Failed to delete document: ${response}`);
    }
  }

  /**
   * Delete a record document
   */
  async deleteRecord(record: ExistingRecordDBDocument): Promise<void> {
    await this.deleteDocument(record._id, record._rev);
  }

  /**
   * Delete a revision document
   */
  async deleteRevision(revision: ExistingRevisionDBDocument): Promise<void> {
    await this.deleteDocument(revision._id, revision._rev);
  }

  /**
   * Delete an AVP document
   */
  async deleteAvp(avp: ExistingAvpDBDocument): Promise<void> {
    await this.deleteDocument(avp._id, avp._rev);
  }

  /**
   * Delete an attachment document
   */
  async deleteAttachment(
    attachment: ExistingAttachmentDBDocument
  ): Promise<void> {
    await this.deleteDocument(attachment._id, attachment._rev);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================
  getDb(): PouchDB.Database {
    return this.db;
  }
}

// ============================================================================
// Configuration Schemas
// ============================================================================

export const conflictBehaviorSchema = z.enum([
  'throw',
  'pickFirst',
  'pickLast',
]);
export type ConflictBehavior = z.infer<typeof conflictBehaviorSchema>;

export const hydratedRecordConfigSchema = z.object({
  behaviorOnConflict: conflictBehaviorSchema.default('throw'),
});

export type HydratedRecordConfig = z.infer<typeof hydratedRecordConfigSchema>;

// ============================================================================
// Error Classes
// ============================================================================

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

export class NoHeadsError extends Error {
  constructor(recordId: string) {
    super(`Record "${recordId}" has no heads - invalid state`);
    this.name = 'NoHeadsError';
  }
}

// ============================================================================
// Hydrated Record Schema & Types
// ============================================================================

export const hydratedRecordSchema = z.object({
  record: existingRecordDocumentSchema,
  revision: existingRevisionDocumentSchema,
  data: z.record(z.string(), existingAvpDocumentSchema),
  metadata: z.object({
    hadConflict: z.boolean(),
    conflictResolution: conflictBehaviorSchema.optional(),
    allHeads: z.array(z.string()),
  }),
});

export type HydratedRecord = z.infer<typeof hydratedRecordSchema>;

// ============================================================================
// Hydrated Record Engine
// ============================================================================

export class HydratedRecordEngine {
  constructor(private readonly dataEngine: DataEngine) {}

  /**
   * Resolve which head to use based on conflict behavior
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
      case 'pickFirst':
        return {
          selectedHead: heads[0],
          hadConflict: true,
        };
      case 'pickLast':
        return {
          selectedHead: heads[heads.length - 1],
          hadConflict: true,
        };
    }
  }

  /**
   * Fetch all AVPs for a revision efficiently
   */
  private async fetchAvps(
    avpIds: Record<string, string>
  ): Promise<Record<string, ExistingAvpDBDocument>> {
    const entries = Object.entries(avpIds);

    // Fetch all AVPs in parallel for efficiency
    const avpPromises = entries.map(async ([fieldName, avpId]) => {
      const avp = await this.dataEngine.getAvp(avpId);
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
   * Get a fully hydrated record with its latest revision and all AVPs
   */
  async getHydratedRecord(
    recordId: string,
    config: Partial<HydratedRecordConfig> = {}
  ): Promise<HydratedRecord> {
    // Validate and set defaults for config
    const validatedConfig = hydratedRecordConfigSchema.parse(config);

    // Step 1: Fetch the record
    const record = await this.dataEngine.getRecord(recordId);

    // Step 2: Resolve which head to use
    const {selectedHead, hadConflict} = this.resolveHead(
      recordId,
      record.heads,
      validatedConfig.behaviorOnConflict
    );

    // Step 3: Fetch the revision
    const revision = await this.dataEngine.getRevision(selectedHead);

    // Step 4: Fetch all AVPs efficiently
    const data = await this.fetchAvps(revision.avps);

    // Step 5: Build the hydrated record
    return {
      record,
      revision,
      data,
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
   * Get multiple hydrated records efficiently
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
   * Check if a record has conflicts
   */
  async hasConflict(recordId: string): Promise<boolean> {
    const record = await this.dataEngine.getRecord(recordId);
    return record.heads.length > 1;
  }

  /**
   * Get all heads for a record
   */
  async getHeads(recordId: string): Promise<string[]> {
    const record = await this.dataEngine.getRecord(recordId);
    return record.heads;
  }
}

// Placeholder type - replace with actual import
type FAIMSTypeName = string;

// ============================================================================
// Form Record Schema & Types
// ============================================================================

export const annotationsSchema = z.object({
  annotation: z.string(),
  uncertainty: z.boolean(),
});

export type Annotations = z.infer<typeof annotationsSchema>;

export const relationshipSchema = z.object({
  parent: z.object({
    record_id: z.string(),
    field_id: z.string(),
    relation_type_vocabPair: z.tuple([z.string(), z.string()]),
  }),
});

export type Relationship = z.infer<typeof relationshipSchema>;

export const formRecordSchema = z.object({
  project_id: z.string().optional(),
  record_id: z.string(),
  revision_id: z.string().nullable(),
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
  updated: z.date(),
  updated_by: z.string().email(),
  field_types: z.record(z.string(), z.string()),
  annotations: z.record(z.string(), annotationsSchema),
  ugc_comment: z.string().optional(),
  created: z.date().optional(),
  created_by: z.string().email().optional(),
  relationship: relationshipSchema.optional().or(z.object({})),
  deleted: z.boolean().optional(),
});

export type FormRecord = z.infer<typeof formRecordSchema>;

// ============================================================================
// ID Generation
// ============================================================================

export function generateRevisionID(): string {
  return 'frev-' + uuidv4();
}

export function generateAvpID(): string {
  return 'avp-' + uuidv4();
}

// ============================================================================
// Form Record Engine
// ============================================================================

export interface FormRecordEngineConfig {
  getEqualityFunctionForType: (
    type: FAIMSTypeName
  ) => (a: any, b: any) => Promise<boolean>;
  getAttachmentDumperForType?: (
    type: FAIMSTypeName
  ) => ((avp: AvpDBDocument) => Array<AvpDBDocument | any>) | null;
}

export class FormRecordEngine {
  constructor(
    private readonly dataEngine: DataEngine,
    private readonly config: FormRecordEngineConfig
  ) {}

  /**
   * Create a brand new record from form data
   */
  async createRecord(formRecord: FormRecord): Promise<string> {
    // Validate form record
    const validated = formRecordSchema.parse(formRecord);

    if (validated.revision_id !== null) {
      throw new Error(
        'Cannot create a new record with a non-null revision_id. Use updateRecord instead.'
      );
    }

    // Generate new revision ID
    const revisionId = generateRevisionID();

    // Step 1: Create Record document
    const recordDoc: Omit<RecordDBDocument, '_rev'> = {
      _id: validated.record_id,
      record_format_version: 1,
      created: validated.updated.toISOString(),
      created_by: validated.updated_by,
      revisions: [revisionId],
      heads: [revisionId],
      type: validated.type,
    };

    try {
      await this.dataEngine.createRecord(recordDoc);
    } catch (err: any) {
      // If record already exists, that's fine - we just want to ensure it exists
      if (err.status !== 409) {
        throw err;
      }
    }

    // Step 2: Create AVPs for all fields
    const avpMap = await this.createAvpsForAllFields({
      formRecord: validated,
      revisionId,
    });

    // Step 3: Create Revision document
    const revisionDoc: Omit<RevisionDBDocument, '_rev'> = {
      _id: revisionId,
      revision_format_version: 1,
      avps: avpMap,
      record_id: validated.record_id,
      parents: [],
      created: validated.updated.toISOString(),
      created_by: validated.updated_by,
      type: validated.type,
      ugc_comment: validated.ugc_comment,
      relationship: validated.relationship ?? {},
    };

    await this.dataEngine.createRevision(revisionDoc);

    return revisionId;
  }

  /**
   * Update an existing record from form data
   */
  async updateRecord(formRecord: FormRecord): Promise<string> {
    // Validate form record
    const validated = formRecordSchema.parse(formRecord);

    if (validated.revision_id === null) {
      throw new Error(
        'Cannot update a record with a null revision_id. Use createRecord instead.'
      );
    }

    // Generate new revision ID
    const newRevisionId = generateRevisionID();

    // Step 1: Fetch parent revision to compare
    const parentRevision = await this.dataEngine.getRevision(
      validated.revision_id
    );

    // Step 2: Determine which AVPs need to be created (changed fields)
    const avpMap = await this.createOrReuseAvps({
      formRecord: validated,
      parentRevision,
      newRevisionId,
    });

    // Step 3: Create new Revision document
    const revisionDoc: Omit<RevisionDBDocument, '_rev'> = {
      _id: newRevisionId,
      revision_format_version: 1,
      avps: avpMap,
      record_id: validated.record_id,
      parents: [validated.revision_id],
      created: validated.updated.toISOString(),
      created_by: validated.updated_by,
      type: validated.type,
      ugc_comment: validated.ugc_comment,
      relationship: validated.relationship ?? {},
    };

    await this.dataEngine.createRevision(revisionDoc);

    // Step 4: Update Record document heads
    await this.updateRecordHeads({
      recordId: validated.record_id,
      oldHeadId: validated.revision_id,
      newHeadId: newRevisionId,
    });

    return newRevisionId;
  }

  /**
   * Convenience method that routes to create or update based on revision_id
   */
  async upsertRecord(formRecord: FormRecord): Promise<string> {
    const validated = formRecordSchema.parse(formRecord);

    if (validated.revision_id === null) {
      return this.createRecord(validated);
    } else {
      return this.updateRecord(validated);
    }
  }

  /**
   * Create AVPs for all fields in a new record
   */
  private async createAvpsForAllFields({
    formRecord,
    revisionId,
  }: {
    formRecord: FormRecord;
    revisionId: string;
  }): Promise<Record<string, string>> {
    const avpMap: Record<string, string> = {};
    const avpsToCreate: Array<Omit<AvpDBDocument, '_rev'>> = [];

    // Create AVP for each field
    for (const [fieldName, fieldValue] of Object.entries(formRecord.data)) {
      const avpId = generateAvpID();

      const avp: Omit<AvpDBDocument, '_rev'> = {
        _id: avpId,
        avp_format_version: 1,
        type: formRecord.field_types[fieldName] ?? '??:??',
        data: fieldValue,
        revision_id: revisionId,
        record_id: formRecord.record_id,
        annotations: formRecord.annotations[fieldName],
        created: formRecord.updated.toISOString(),
        created_by: formRecord.updated_by,
      };

      avpsToCreate.push(avp);
      avpMap[fieldName] = avpId;
    }

    // Create all AVPs (with attachment handling if configured)
    await this.bulkCreateAvps(avpsToCreate);

    return avpMap;
  }

  /**
   * Create new AVPs for changed fields, reuse AVP IDs for unchanged fields
   */
  private async createOrReuseAvps({
    formRecord,
    parentRevision,
    newRevisionId,
  }: {
    formRecord: FormRecord;
    parentRevision: ExistingRevisionDBDocument;
    newRevisionId: string;
  }): Promise<Record<string, string>> {
    const avpMap: Record<string, string> = {};
    const avpsToCreate: Array<Omit<AvpDBDocument, '_rev'>> = [];

    // Fetch all parent AVPs efficiently in parallel
    const parentAvpIds = Object.values(parentRevision.avps);
    const parentAvpPromises = parentAvpIds.map(id =>
      this.dataEngine.getAvp(id)
    );
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
      const fieldType = formRecord.field_types[fieldName];
      const fieldAnnotation = formRecord.annotations[fieldName];

      const parentAvp = parentAvpsByField.get(fieldName);

      // Determine if data or annotations changed
      const equalityFn = this.config.getEqualityFunctionForType(fieldType);

      const hasDataChanged =
        parentAvp === undefined
          ? true
          : !(await equalityFn(parentAvp.data, fieldValue));

      const hasAnnotationChanged =
        parentAvp === undefined
          ? true
          : !(await equalityFn(parentAvp.annotations, fieldAnnotation));

      if (hasDataChanged || hasAnnotationChanged) {
        // Create new AVP
        const avpId = generateAvpID();

        const avp : AvpDBDocument = {
          _id: avpId,
          avp_format_version: 1,
          type: fieldType,
          data: fieldValue,
          revision_id: newRevisionId,
          record_id: formRecord.record_id,
          annotations: fieldAnnotation,
          created: formRecord.updated.toISOString(),
          created_by: formRecord.updated_by,
        };

        avpsToCreate.push(avp);
        avpMap[fieldName] = avpId;
      } else {
        // Reuse existing AVP ID - this is definitely defined at this point
        // given the checks
        avpMap[fieldName] = parentAvp!._id;
      }
    }

    // Create all new AVPs (with attachment handling if configured)
    await this.bulkCreateAvps(avpsToCreate);

    return avpMap;
  }

  /**
   * Bulk create AVPs, handling attachments if dumper is configured
   */
  private async bulkCreateAvps(
    avps: Array<Omit<AvpDBDocument, '_rev'>>
  ): Promise<void> {
    if (avps.length === 0) {
      return;
    }

    // If attachment dumper is configured, process attachments
    if (this.config.getAttachmentDumperForType) {
      const allDocsToCreate: any[] = [];

      for (const avp of avps) {
        const dumper = this.config.getAttachmentDumperForType(avp.type);
        if (dumper) {
          // Dumper returns array of [avp, ...attachments]
          const docs = dumper(avp as AvpDBDocument);
          allDocsToCreate.push(...docs);
        } else {
          allDocsToCreate.push(avp);
        }
      }

      // Use PouchDB bulkDocs for efficiency
      const db = this.dataEngine.getDb();
      await db.bulkDocs(allDocsToCreate);
    } else {
      // No attachment handling, just create AVPs
      for (const avp of avps) {
        await this.dataEngine.createAvp(avp);
      }
    }
  }

  /**
   * Update Record document's heads and revisions arrays
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
    const record = await this.dataEngine.getRecord(recordId);

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

    await this.dataEngine.updateRecord(updatedRecord);
  }
}
