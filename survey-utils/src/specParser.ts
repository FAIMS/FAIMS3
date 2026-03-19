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
  const rawSpec = obj['ui-specification'] ?? obj;
  if (!rawSpec || typeof rawSpec !== 'object') return null;
  const spec = rawSpec as UiSpecification;
  if (!spec.fields || !spec.viewsets) return null;
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

/** Resolved views/fviews map with normalized field name lists */
export function getViewsMap(spec: UiSpecification): Record<string, { label?: string; fields: string[] }> {
  const v = spec.fviews ?? spec.views;
  const out: Record<string, { label?: string; fields: string[] }> = {};
  if (!v || typeof v !== 'object') return out;
  for (const id of Object.keys(v)) {
    const x = v[id];
    out[id] = { label: x?.label, fields: normalizeFieldNameList(x?.fields) };
  }
  return out;
}

function getViews(spec: UiSpecification): Record<string, { label?: string; fields: string[] }> {
  return getViewsMap(spec);
}

/** Accept view ids as an array, a single id string, or missing */
export function normalizeFieldNameList(fields: unknown): string[] {
  if (Array.isArray(fields)) return fields.filter((f): f is string => typeof f === 'string');
  if (typeof fields === 'string' && fields) return [fields];
  return [];
}

/**
 * All viewsets in a stable order: visible_types first (when valid), then any remaining keys.
 * Ensures every form in viewsets is included even if missing from visible_types.
 */
export function getOrderedViewsetIds(spec: UiSpecification): string[] {
  const allKeys = Object.keys(spec.viewsets);
  const raw = spec.visible_types;
  const preferred: string[] = Array.isArray(raw)
    ? raw.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : typeof raw === 'string' && raw
      ? [raw]
      : [];
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of preferred) {
    if (spec.viewsets[id] && !seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }
  for (const id of allKeys) {
    if (!seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }
  return ordered;
}

/** View ids listed on a viewset (array or single string) */
export function normalizeViewIdList(views: unknown): string[] {
  if (Array.isArray(views)) return views.filter((v): v is string => typeof v === 'string');
  if (typeof views === 'string' && views) return [views];
  return [];
}

export function getLabel(params: ComponentParams): string {
  return (
    params?.label ??
    params?.InputLabelProps?.label ??
    params?.FormControlLabelProps?.label ??
    params?.name ??
    ''
  );
}

/** Primary helper for display (excludes advanced; detailed export shows advanced separately) */
export function getPrimaryHelperText(params: ComponentParams): string {
  return (
    params?.helperText ??
    (typeof params?.FormHelperTextProps?.children === 'string'
      ? params.FormHelperTextProps.children
      : '') ??
    ''
  );
}

/** Table column: first non-empty of primary helper or advanced (legacy behaviour) */
function getTableHelperText(params: ComponentParams): string {
  return (
    params?.helperText ??
    (typeof params?.FormHelperTextProps?.children === 'string'
      ? params.FormHelperTextProps.children
      : '') ??
    params?.advancedHelperText ??
    ''
  );
}

/** Flatten option tree to list of labels (for AdvancedSelect) */
export function flattenOptionTree(nodes: OptionTreeNode[] | undefined, depth = 0): string[] {
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
  const helper = getTableHelperText(params);

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

export function getFieldTypeLabel(field: FieldSpec): string {
  return field.humanReadableName ?? field['component-name'] ?? '—';
}

/**
 * Derive the list of review rows from a normalized UI specification.
 * Order: by visible_types, then by viewset view order, then by view field order.
 */
export function deriveReviewTable(spec: UiSpecification): SpecReviewRow[] {
  const views = getViews(spec);
  const viewsetIds = getOrderedViewsetIds(spec);
  const rows: SpecReviewRow[] = [];

  for (const viewsetId of viewsetIds) {
    const viewset = spec.viewsets[viewsetId];
    const viewIds = normalizeViewIdList(viewset?.views);
    if (!viewset || viewIds.length === 0) continue;
    const formLabel = viewset.label ?? viewsetId;

    for (const viewId of viewIds) {
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
          questionType: getFieldTypeLabel(field),
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
