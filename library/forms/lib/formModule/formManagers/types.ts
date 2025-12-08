import {
  AvpUpdateMode,
  DataEngine,
  IAttachmentService,
} from '@faims3/data-model';
import {FormNavigationChildEntry} from './EditableFormManager';

/**
 * Base interface for form configuration modes.
 */
export interface BaseFormConfig {
  mode: 'full' | 'preview';
  layout: 'inline' | 'tabs';
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
      // parent)
      stripNavigationEntry?: boolean;
    }) => void;
    /** Navigate to a record (latest revision) */
    getToRecordLink: (params: {
      recordId: string;
      mode: AvpUpdateMode;
    }) => string;
    /** A function which routes the browser to a target location */
    navigateToLink: (to: string) => void;
    /** Return to the previous context e.g. the record list */
    // TODO
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
