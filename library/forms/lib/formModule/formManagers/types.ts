import {
  AvpUpdateMode,
  DataEngine,
  IAttachmentService,
} from '@faims3/data-model';

/**
 * Base interface for form configuration modes.
 */
export interface BaseFormConfig {
  mode: 'full' | 'preview';
}

/**
 * Additional handlers injected by the form manager and passed down to field components.
 * These allow fields to interact with attachments (photos, files, etc.), as well as
 * providing field form 'runtime' triggers such as committing the current record.
 */
export interface FormManagerAdditions {
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
    }) => Promise<void>;
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
  /** Navigation functions for redirecting to other records */
  redirect: {
    /** Navigate to a record (latest revision) */
    toRecord: (params: {recordId: string; mode: AvpUpdateMode}) => void;
    /** Navigate to a specific record revision */
    toRevision: (params: {
      recordId: string;
      revisionId: string;
      mode: AvpUpdateMode;
    }) => void;
  };
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
