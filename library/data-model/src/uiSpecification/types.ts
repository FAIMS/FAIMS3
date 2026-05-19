import {z} from 'zod';
import {UISpecificationSchema} from '../types';

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

/**
 * Inlined former notebook JSON + metadata DB merge.
 * `uiSpec` base type = existing **`EncodedProjectUIModel`** (`fields`, `fviews`, `viewsets`, `visible_types`; legacy keys inside `fields` unchanged) + **`settings`**.
 */
export const SurveyNotebookUiSpecSchema = UISpecificationSchema.and(
  z.object({
    /** UI Functional settings */
    settings: NotebookSettingsSchema,
    /** Drives notebook migration / compatibility */
    schemaVersion: z.string(),
  })
);

export const SurveyNotebookDefinitionSchema = z.object({
  uiSpec: SurveyNotebookUiSpecSchema,
  metadata: NotebookMetadataSchema,
});
export type SurveyNotebookDefinition = z.infer<
  typeof SurveyNotebookDefinitionSchema
>;
