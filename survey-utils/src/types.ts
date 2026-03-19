/**
 * Minimal types for FAIMS UI specification (survey/notebook).
 * Matches the encoded format: fields, fviews (or views), viewsets, visible_types.
 */

export interface ComponentParams {
  label?: string;
  helperText?: string;
  advancedHelperText?: string;
  name?: string;
  required?: boolean;
  InputLabelProps?: { label?: string };
  FormControlLabelProps?: { label?: string };
  FormHelperTextProps?: { children?: string };
  /** RelatedRecordSelector: target form / viewset id */
  related_type?: string;
  relation_type?: string;
  /** RichText / static markdown or HTML body */
  content?: string;
  ElementProps?: {
    options?: Array<{ value: string; label: string; key?: string }>;
    optiontree?: OptionTreeNode[];
    expandedChecklist?: boolean;
    exclusiveOptions?: string[];
    enableOtherOption?: boolean;
    otherOptionPosition?: number;
  };
  [key: string]: unknown;
}

export interface OptionTreeNode {
  id: string;
  name: string;
  type?: string;
  label?: string;
  children?: OptionTreeNode[];
}

export interface FieldSpec {
  'component-namespace'?: string;
  'component-name': string;
  'type-returned'?: string;
  'component-parameters': ComponentParams;
  humanReadableName?: string;
  humanReadableDescription?: string;
  category?: string;
  meta?: {
    annotation?: { include?: boolean; label?: string };
    uncertainty?: { include?: boolean; label?: string };
  };
  [key: string]: unknown;
}

export interface ViewSpec {
  label?: string;
  fields: string[];
  description?: string;
  [key: string]: unknown;
}

export interface ViewsetSpec {
  label?: string;
  views: string[];
  [key: string]: unknown;
}

export interface UiSpecification {
  fields: Record<string, FieldSpec>;
  fviews?: Record<string, ViewSpec>;
  views?: Record<string, ViewSpec>;
  viewsets: Record<string, ViewsetSpec>;
  visible_types?: string[];
}

/** Metadata from a full notebook JSON (when present) */
export interface SpecMetadata {
  name?: string;
  project_id?: string;
  project_lead?: string;
  lead_institution?: string;
  project_status?: string;
  pre_description?: string;
  [key: string]: unknown;
}

export interface NotebookJson {
  'ui-specification'?: UiSpecification;
  metadata?: SpecMetadata;
}

/** One row in the review table */
export interface SpecReviewRow {
  /** Display name / title of the question (from field label) */
  questionTitle: string;
  form: string;
  section: string;
  questionType: string;
  questionContent: string;
  notes?: string;
}

/** Export payload: table rows + optional metadata */
export interface SpecExportData {
  metadata?: SpecMetadata;
  rows: SpecReviewRow[];
  exportedAt: string;
}
