import type {
  UiSpecification,
  FieldSpec,
  ComponentParams,
  OptionTreeNode,
  SpecReviewRow,
  SpecMetadata,
} from './types';

/**
 * Normalize uploaded JSON: accept full notebook or raw ui-specification.
 */
export function normalizeUiSpec(json: unknown): UiSpecification | null {
  if (!json || typeof json !== 'object') return null;
  const obj = json as Record<string, unknown>;
  const spec = (obj['ui-specification'] as UiSpecification) ?? (obj as UiSpecification);
  if (!spec || !spec.fields || !spec.viewsets) return null;
  const views = spec.fviews ?? spec.views;
  if (!views || typeof views !== 'object') return null;
  return { ...spec, views, fviews: views } as UiSpecification;
}

/** Extract metadata from full notebook JSON if present */
export function extractMetadata(json: unknown): SpecMetadata | undefined {
  if (!json || typeof json !== 'object') return undefined;
  const obj = json as Record<string, unknown>;
  const meta = obj.metadata ?? obj['metadata'];
  if (!meta || typeof meta !== 'object') return undefined;
  return meta as SpecMetadata;
}

function getViews(spec: UiSpecification): Record<string, { label?: string; fields: string[] }> {
  const v = spec.fviews ?? spec.views;
  const out: Record<string, { label?: string; fields: string[] }> = {};
  for (const id of Object.keys(v)) {
    const x = v[id];
    out[id] = { label: x?.label, fields: Array.isArray(x?.fields) ? x.fields : [] };
  }
  return out;
}

function getLabel(params: ComponentParams): string {
  return (
    params?.label ??
    params?.InputLabelProps?.label ??
    params?.FormControlLabelProps?.label ??
    params?.name ??
    ''
  );
}

function getHelperText(params: ComponentParams): string {
  const helper =
    params?.helperText ??
    (typeof params?.FormHelperTextProps?.children === 'string'
      ? params.FormHelperTextProps.children
      : '') ??
    params?.advancedHelperText ??
    '';
  return helper;
}

/** Flatten option tree to list of labels (for AdvancedSelect) */
function flattenOptionTree(nodes: OptionTreeNode[] | undefined, depth = 0): string[] {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];
  const lines: string[] = [];
  for (const node of nodes) {
    const label = node.label ?? node.name ?? node.id ?? '';
    if (label) lines.push('  '.repeat(depth) + '• ' + label);
    if (node.children?.length) {
      lines.push(...flattenOptionTree(node.children, depth + 1));
    }
  }
  return lines;
}

/**
 * Build human-readable question content for the review table, depending on field type.
 */
function getQuestionContent(field: FieldSpec): string {
  const params = field['component-parameters'];
  if (!params) return '';
  const label = getLabel(params);
  const helper = getHelperText(params);

  const parts: string[] = [];
  if (label) parts.push(label);
  if (helper) parts.push(helper);

  const el = params.ElementProps;
  if (el?.options?.length) {
    parts.push('Options:');
    for (const opt of el.options) {
      const text = opt.label ?? opt.value;
      if (text) parts.push('• ' + text);
    }
    if (el.enableOtherOption) parts.push('• Other (free text)');
  } else if (el?.optiontree?.length) {
    parts.push('Options (tree):');
    parts.push(...flattenOptionTree(el.optiontree));
  }

  return parts.join('\n').trim() || '—';
}

function getQuestionType(field: FieldSpec): string {
  return field.humanReadableName ?? field['component-name'] ?? '—';
}

/**
 * Derive the list of review rows from a normalized UI specification.
 * Order: by visible_types, then by viewset view order, then by view field order.
 */
export function deriveReviewTable(spec: UiSpecification): SpecReviewRow[] {
  const views = getViews(spec);
  const viewsetIds = spec.visible_types?.length
    ? spec.visible_types
    : Object.keys(spec.viewsets);
  const rows: SpecReviewRow[] = [];

  for (const viewsetId of viewsetIds) {
    const viewset = spec.viewsets[viewsetId];
    if (!viewset?.views?.length) continue;
    const formLabel = viewset.label ?? viewsetId;

    for (const viewId of viewset.views) {
      const view = views[viewId];
      if (!view) continue;
      const sectionLabel = view.label ?? viewId;

      for (const fieldName of view.fields) {
        const field = spec.fields[fieldName];
        if (!field) continue;
        const params = field['component-parameters'];
        const questionTitle = params ? getLabel(params) || fieldName : fieldName;
        rows.push({
          questionTitle,
          form: formLabel,
          section: sectionLabel,
          questionType: getQuestionType(field),
          questionContent: getQuestionContent(field),
          notes: '',
        });
      }
    }
  }

  return rows;
}

/**
 * Parse uploaded file content and return review rows or an error message.
 */
export function parseSpecFile(content: string): {
  ok: true;
  rows: SpecReviewRow[];
  spec: UiSpecification;
  metadata?: SpecMetadata;
} | {
  ok: false;
  error: string;
} {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }

  const spec = normalizeUiSpec(json);
  if (!spec) {
    return {
      ok: false,
      error: 'Not a valid UI specification: expected fields, views/fviews, and viewsets',
    };
  }

  const metadata = extractMetadata(json);
  const rows = deriveReviewTable(spec);
  return { ok: true, rows, spec, metadata };
}
