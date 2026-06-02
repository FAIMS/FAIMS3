import {z} from 'zod';
import {ProjectUIModel} from '../types';

export type ValuesObject = {[fieldName: string]: any};
export type ViewsetId = string;
export type HridFieldMap = Record<ViewsetId, string | undefined>;

/**
 * UI behaviour toggles
 */
export const NotebookSettingsSchema = z.object({
  /** When true, show “search by QR” on the record list for this survey */
  showQrCodeButton: z.boolean(),
});
export type NotebookSettings = z.infer<typeof NotebookSettingsSchema>;

/**
 * Non-functional **design** documentation bundled with the form definition.
 */
export const NotebookInformationSchema = z.object({
  /** Notebook / designer semver or similar - user managed */
  notebookVersion: z.string(),
  /** Long-form design intent — former `pre_description` */
  purposeMarkdown: z.string(),
  /** Responsible person label for the design — former `project_lead`; not a
   * user id */
  projectLeadLabel: z.string(),
  /** Free text field to track creating institution */
  leadInstitution: z.string(),
  /**
   * Source template id when this definition was derived or copied from another
   * template design.
   */
  derivedFromTemplateId: z.string().optional(),
});
export type NotebookInformation = z.infer<typeof NotebookInformationSchema>;

/** Typed design metadata + optional org extensions */
export const NotebookMetadataSchema = z.object({
  /** Information about the notebook - non functional */
  information: NotebookInformationSchema,
  /** Optional key/value bag for org-specific tagging; not for settings or user
   * ids */
  custom: z.record(z.any()).optional(),
});
export type NotebookMetadata = z.infer<typeof NotebookMetadataSchema>;

// TODO define this e2e with zod
export const UISpecificationSchema = z
  .custom<ProjectUIModel>()
  .refine(val => !!val);
export type UISpecification = z.infer<typeof UISpecificationSchema>;

/**
 * Inlined former notebook JSON + metadata DB merge.
 * `uiSpec` = decoded **`ProjectUIModel`** (`fields`, `views`, `viewsets`, `visible_types`) + **`settings`** + **`schemaVersion`**.
 */
export const NotebookUiSpecSchema = UISpecificationSchema.and(
  z.object({
    /** UI Functional settings */
    settings: NotebookSettingsSchema,
    /** Drives notebook migration / compatibility */
    schemaVersion: z.string(),
  })
);
export type NotebookUiSpec = z.infer<typeof NotebookUiSpecSchema>;

export const NotebookDefinitionSchema = z.object({
  uiSpec: NotebookUiSpecSchema,
  metadata: NotebookMetadataSchema,
});
export type NotebookDefinition = z.infer<typeof NotebookDefinitionSchema>;

const isPlainObjectRecord = (
  value: unknown
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Download JSON / PUT uiSpecification body: {@link NotebookDefinition} at the
 * root (not wrapped in a `uiSpecification` property).
 */
export const NotebookDefinitionUploadSchema = z
  .custom<Record<string, unknown>>(isPlainObjectRecord, {
    message: 'JSON must be an object',
  })
  .refine(val => val.uiSpecification === undefined, {
    message:
      'JSON must use top-level metadata and uiSpec (not a wrapped uiSpecification object)',
  })
  .pipe(NotebookDefinitionSchema);
