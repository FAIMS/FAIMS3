/**
 * Types for FAIMS UI specification (notebook) — schema version 5.0 only.
 * Wire terminology: 'views' = sections, 'viewsets' = forms.
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
  /** MapFormField: geometry type captured by this field */
  featureType?: 'Point' | 'Polygon' | 'LineString';
  /** MapFormField: show "use current location" button */
  allowSetToCurrentPoint?: boolean;
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

/** A section: a named group of fields (wire key: 'views'). */
export interface ViewSpec {
  label?: string;
  fields: string[];
  description?: string;
  condition?: unknown;
  [key: string]: unknown;
}

/** A form: a named form type composed of one or more sections (wire key: 'viewsets'). */
export interface ViewsetSpec {
  label?: string;
  views: string[];
  is_visible?: boolean;
  summary_fields?: string[];
  hridField?: string;
  layout?: 'inline' | 'tabs';
  [key: string]: unknown;
}

/** UI behaviour toggles. */
export interface NotebookSettings {
  showQrCodeButton: boolean;
}

/**
 * The UI specification model — schema version 5.0.
 * 'views' = sections, 'viewsets' = forms (wire terminology retained from original spec).
 */
export interface UiSpecification {
  fields: Record<string, FieldSpec>;
  views: Record<string, ViewSpec>;
  viewsets: Record<string, ViewsetSpec>;
  visible_types: string[];
  settings: NotebookSettings;
  schemaVersion: string;
}

/** Non-functional design documentation bundled with the form definition. */
export interface NotebookInformation {
  notebookVersion: string;
  /** Long-form design intent (formerly `pre_description`). */
  purposeMarkdown: string;
  /** Responsible-person label for the design (formerly `project_lead`). */
  projectLeadLabel: string;
  leadInstitution: string;
  derivedFromTemplateId?: string;
}

/** Notebook metadata: design information plus optional org extensions. */
export interface NotebookMetadata {
  information: NotebookInformation;
  custom?: Record<string, unknown>;
}

/** Full notebook definition — schema version 5.0. */
export interface NotebookDefinition {
  uiSpec: UiSpecification;
  metadata: NotebookMetadata;
}

/** One row in the review table */
export interface SpecReviewRow {
  questionTitle: string;
  form: string;
  section: string;
  questionType: string;
  questionContent: string;
  notes?: string;
}

/** Export payload: table rows + optional metadata + timestamp */
export interface SpecExportData {
  metadata?: NotebookMetadata;
  rows: SpecReviewRow[];
  exportedAt: string;
}
