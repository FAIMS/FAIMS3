import {z} from 'zod';
import {DatabaseInterface, PossibleConnectionInfo} from '../../types';
import {PersistedRootDescriptionSchema} from '../rootMetadata';
import {CouchDocumentSchema, CouchExistingDocumentSchema} from '../utils';
import {NotebookDefinitionSchema} from '../../uiSpecification';

/** Couch connection descriptor for per-project data/metadata databases. */
export const PossibleConnectionInfoSchema: z.ZodType<PossibleConnectionInfo> =
  z.object({
    base_url: z.string().optional(),
    proto: z.string().optional(),
    host: z.string().optional(),
    port: z.number().optional(),
    db_name: z.string().optional(),
    auth: z
      .object({
        username: z.string(),
        password: z.string(),
      })
      .optional(),
    jwt_token: z.string().optional(),
  });

// =============
// V1 Definition
// =============

export const ProjectV1FieldsSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  // Was the project created from a template?
  template_id: z.string().optional(),
  data_db: PossibleConnectionInfoSchema.optional(),
  metadata_db: PossibleConnectionInfoSchema.optional(),
  last_updated: z.string().optional(),
  created: z.string().optional(),
  status: z.string().optional(),
  // Team ownership? Undefined means owned by an individual
  ownedByTeamId: z.string().optional(),
});
export type ProjectV1Fields = z.infer<typeof ProjectV1FieldsSchema>;

export const ProjectV1DocumentSchema = CouchDocumentSchema.extend(
  ProjectV1FieldsSchema.shape
);
export type ProjectV1Document = z.infer<typeof ProjectV1DocumentSchema>;

/** Stored project status before the ARCHIVED lifecycle value existed (projects DB v2). */
export enum ProjectStatusV2 {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

/**
 * Current survey lifecycle on the project document (projects DB v3+).
 * Name kept as {@link ProjectStatus} (not `ProjectStatusV3`) for stable imports.
 */
export enum ProjectStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
}

// =============
// V2 Definition
// =============

export const ProjectV2FieldsSchema = z.object({
  name: z.string(),
  status: z.nativeEnum(ProjectStatusV2),
  dataDb: PossibleConnectionInfoSchema,
  metadataDb: PossibleConnectionInfoSchema,
  ownedByTeamId: z.string().optional(),
  templateId: z.string().optional(),
});
export type ProjectV2Fields = z.infer<typeof ProjectV2FieldsSchema>;

export const ProjectV2DocumentSchema = CouchDocumentSchema.extend(
  ProjectV2FieldsSchema.shape
);
export type ProjectV2Document = z.infer<typeof ProjectV2DocumentSchema>;

// =============
// V3 Definition
// =============

export const ProjectV3FieldsSchema = ProjectV2FieldsSchema.omit({
  status: true,
}).extend({
  status: z.nativeEnum(ProjectStatus),
});
export type ProjectV3Fields = z.infer<typeof ProjectV3FieldsSchema>;

export const ProjectV3DocumentSchema = CouchDocumentSchema.extend(
  ProjectV3FieldsSchema.shape
);
export type ProjectV3Document = z.infer<typeof ProjectV3DocumentSchema>;

// =============
// V4 Definition
// =============

/**
 * Projects DB v4 — extend this schema when adding new persisted project fields.
 * Update alongside {@link projectsV3toV4Migration}.
 */
export const ProjectV4FieldsSchema = z.object({
  // User metadata about projects - update with PUT /:id { ...name, ...description }
  name: z.string(),
  description: PersistedRootDescriptionSchema,

  // Team / lineage
  templateId: z.string().optional(),
  ownedByTeamId: z.string().optional(),

  // New information about projects - tracked automatically
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),

  // Project lifecycle
  status: z.nativeEnum(ProjectStatus),

  // Project connection information
  dataDb: PossibleConnectionInfoSchema,

  // UI Specification (now stored in the project)
  // NOTE: This is never 'encoded' anymore - no more fviews etc.
  uiSpecification: NotebookDefinitionSchema,
});
export type ProjectV4Fields = z.infer<typeof ProjectV4FieldsSchema>;

export const ProjectV4DocumentSchema = CouchDocumentSchema.extend(
  ProjectV4FieldsSchema.shape
);
export type ProjectV4Document = z.infer<typeof ProjectV4DocumentSchema>;

// =============
// Current exports
// =============

export const ProjectDBFieldsSchema = ProjectV4FieldsSchema;
export type ProjectDBFields = z.infer<typeof ProjectDBFieldsSchema>;

export const ProjectDocumentSchema = ProjectV4DocumentSchema;
export type ProjectDocument = z.infer<typeof ProjectDocumentSchema>;

export const ExistingProjectDocumentSchema = CouchExistingDocumentSchema.extend(
  ProjectDBFieldsSchema.shape
);
export type ExistingProjectDocument = z.infer<
  typeof ExistingProjectDocumentSchema
>;

/** Stored project shape without the form payload (matches listing view value). */
export const ProjectListItemSchema = ExistingProjectDocumentSchema.omit({
  uiSpecification: true,
});
export type ProjectListItem = z.infer<typeof ProjectListItemSchema>;

export type ProjectDB = DatabaseInterface<ProjectDBFields>;
