import {
  AvpUpdateMode,
  DataEngine,
  IAttachmentService,
} from '@faims3/data-model';
import z from 'zod';

/**
 * Base interface for form configuration modes.
 */
export interface BaseFormConfig {
  mode: 'full' | 'preview';
  layout: 'inline' | 'tabs';
}

// When we redirect to a child, we leave this trail, which helps us to navigate
// naturally
export const FormNavigationChildEntrySchema = z.object({
  recordId: z.string(),
  revisionId: z.string().optional(),
  parentMode: z.enum(['parent', 'new']),
  fieldId: z.string(),
});

// This helps track a redirect that just occurred
export const RedirectInfoSchema = z.object({
  // Where should scroll to
  fieldId: z.string(),
});
export type RedirectInfo = z.infer<typeof RedirectInfoSchema>;

export const FormNavigationContextChildSchema = z.object({
  mode: z.literal('child'),
  lineage: z.array(FormNavigationChildEntrySchema),
  // Have we just been redirected from somewhere?
  scrollTarget: RedirectInfoSchema.optional(),
});

export const FormNavigationContextRootSchema = z.object({
  mode: z.literal('root'),
  // Have we just been redirected from somewhere?
  scrollTarget: RedirectInfoSchema.optional(),
});

export const FormNavigationContextSchema = z.discriminatedUnion('mode', [
  FormNavigationContextChildSchema,
  FormNavigationContextRootSchema,
]);

// Inferred types
export type FormNavigationChildEntry = z.infer<
  typeof FormNavigationChildEntrySchema
>;
export type FormNavigationContextChild = z.infer<
  typeof FormNavigationContextChildSchema
>;
export type FormNavigationContextRoot = z.infer<
  typeof FormNavigationContextRootSchema
>;
export type FormNavigationContext = z.infer<typeof FormNavigationContextSchema>;

/**
 * Additional handlers injected by the form manager and passed down to field components.
 * These allow fields to interact with attachments (photos, files, etc.), as well as
 * providing field form 'runtime' triggers such as committing the current record.
 */
export interface FormManagerAdditions {
  /** The nav context */
  navigationContext: FormNavigationContext;
  attachmentHandlers: {
    /** Add a new attachment to a field (inserted at start of attachment list) */
    addAttachment: (params: {
      fieldId: string;
      blob: Blob;
      contentType: string;
      // This informs how to name things
      type: 'photo' | 'file';
      // This informs the file format in the file system e.g. pdf
      fileFormat: string;
    }) => Promise<string>;
    /** Remove an attachment from a field by its ID */
    removeAttachment: (params: {
      fieldId: string;
      attachmentId: string;
    }) => Promise<void>;
  };
  /** Special behavior triggers */
  trigger: {
    /** Force a commit/save of the current record */
    commit: () => Promise<void>;
  };
}

/**
 * Full mode configuration - provides complete data engine access and functionality.
 * Used when forms are embedded in the full application context.
 */
export interface FullFormConfig extends BaseFormConfig {
  mode: 'full';
  // What is the current record ID?
  recordId: string;
  /** Function to get current data engine instance (function allows for DB updates) */
  dataEngine: () => DataEngine;
  /** Function to get attachment service instance */
  attachmentEngine: () => IAttachmentService;
  /** What update mode ? */
  recordMode: AvpUpdateMode;
  /** Navigation functions for redirecting to other records */
  navigation: {
    /** Navigate to a record (latest revision) */
    toRecord: (params: {
      recordId: string;
      mode: AvpUpdateMode;
      // If you want to push another navigation entry
      addNavigationEntry?: FormNavigationChildEntry;
      // If you want to strip the head nav entry (such as when returning to
      // parent) - how many to strip
      stripNavigationEntry?: number;
      // Do you want to leave a redirection trail to scroll to target?
      scrollTarget?: RedirectInfo;
    }) => void;
    /** Navigate to a record (latest revision) */
    getToRecordLink: (params: {
      recordId: string;
      mode: AvpUpdateMode;
    }) => string;
    /** A function which routes the browser to a target location */
    navigateToLink: (to: string) => void;
    /** Return to the previous context e.g. the record list */
    navigateToRecordList: {
      // e.g. return to record list
      label: string;
      // function which does this
      navigate: () => void;
    };
    /** Navigate to the view records (if there is no parent context) */
    navigateToViewRecord:  (params: {recordId: string}) => void;
  };
  /** What is the deployed app name - helpful for error displays etc */
  appName: string;
  /** Current active user identifier (for audit trails) */
  user: string;
}

/**
 * Preview mode configuration - limited functionality for form
 * designer/previews. Used when forms are displayed outside the full application
 * context.
 */
export interface PreviewFormConfig extends BaseFormConfig {
  mode: 'preview';
}

// Discriminated union
export type FormConfig = FullFormConfig | PreviewFormConfig;
export type FullFormManagerConfig = FullFormConfig & FormManagerAdditions;
export type PreviewFormManagerConfig = PreviewFormConfig;
export type FormManagerConfig =
  | FullFormManagerConfig
  | PreviewFormManagerConfig;
