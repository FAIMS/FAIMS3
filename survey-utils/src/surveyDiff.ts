import type { FieldSpec, UiSpecification, ViewSpec, ViewsetSpec } from './types';
import {
  getLabel,
  getOrderedViewsetIds,
  getViewsMap,
  normalizeFieldNameList,
  normalizeViewIdList,
} from './specParser';

/** Single property path change (generic JSON diff leaf or subtree) */
export interface ValueChange {
  path: string;
  before: unknown;
  after: unknown;
}

export type DiffStatus = 'unchanged' | 'added' | 'removed' | 'modified';

export interface QuestionDiffNode {
  fieldId: string;
  displayLeft: string;
  displayRight: string;
  status: DiffStatus;
  /** Present when status is `modified` */
  changes?: ValueChange[];
}

export interface SectionDiffNode {
  sectionId: string;
  displayLeft: string;
  displayRight: string;
  status: DiffStatus;
  /** View metadata excluding `fields` */
  metaChanges?: ValueChange[];
  /** Same section ids, different order */
  fieldOrderChanged?: boolean;
  questions: QuestionDiffNode[];
}

export interface FormDiffNode {
  formId: string;
  displayLeft: string;
  displayRight: string;
  status: DiffStatus;
  /** Viewset metadata excluding `views` */
  metaChanges?: ValueChange[];
  /** Same section ids, different order */
  sectionOrderChanged?: boolean;
  sections: SectionDiffNode[];
}

export interface SurveyDiffResult {
  forms: FormDiffNode[];
  /** ISO timestamp when diff was computed (for exports) */
  generatedAt: string;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Stable deep equality for JSON-like values */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== (b as unknown[]).length) return false;
    return a.every((x, i) => deepEqual(x, (b as unknown[])[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) {
    if (!deepEqual(ao[k], bo[k])) return false;
  }
  return true;
}

function formatValueForDisplay(v: unknown): string {
  if (v === undefined) return '—';
  if (v === null) return 'null';
  if (typeof v === 'string') return v.length > 200 ? v.slice(0, 200) + '…' : v;
  try {
    return JSON.stringify(v, null, 0);
  } catch {
    return String(v);
  }
}

/**
 * Recursive diff of two JSON-like values into a flat list of path changes.
 * Arrays are compared element-wise only when lengths match and both elements are objects;
 * otherwise a single change at `path` is emitted.
 */
export function diffValues(a: unknown, b: unknown, path = ''): ValueChange[] {
  if (deepEqual(a, b)) return [];
  if (!isPlainObject(a) || !isPlainObject(b)) {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) {
        return [{ path: path || '(root)', before: a, after: b }];
      }
      const out: ValueChange[] = [];
      for (let i = 0; i < a.length; i++) {
        const p = path ? `${path}[${i}]` : `[${i}]`;
        out.push(...diffValues(a[i], b[i], p));
      }
      return out;
    }
    return [{ path: path || '(root)', before: a, after: b }];
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const sorted = [...keys].sort();
  const out: ValueChange[] = [];
  for (const k of sorted) {
    const p = path ? `${path}.${k}` : k;
    out.push(...diffValues(a[k], b[k], p));
  }
  return out;
}

function omitKey<T extends Record<string, unknown>>(obj: T, key: string): Record<string, unknown> {
  const { [key]: _, ...rest } = obj;
  return rest;
}

function fieldDisplay(spec: UiSpecification, fieldId: string): string {
  const f = spec.fields[fieldId] as FieldSpec | undefined;
  if (!f) return fieldId;
  const params = f['component-parameters'];
  const label = params ? getLabel(params) : '';
  return (label && String(label)) || fieldId;
}

function viewDisplayLabel(spec: UiSpecification, viewId: string): string {
  const views = getViewsMap(spec);
  return views[viewId]?.label ?? viewId;
}

function viewsetDisplayLabel(spec: UiSpecification, viewsetId: string): string {
  return spec.viewsets[viewsetId]?.label ?? viewsetId;
}

function sameSetOrder(a: string[], b: string[]): { sameSet: boolean; sameOrder: boolean } {
  if (a.length !== b.length) return { sameSet: false, sameOrder: false };
  const sb = new Set(b);
  for (const x of a) {
    if (!sb.has(x)) return { sameSet: false, sameOrder: false };
  }
  const sameOrder = a.every((x, i) => x === b[i]);
  return { sameSet: true, sameOrder };
}

function viewsetMeta(viewset: ViewsetSpec | undefined): Record<string, unknown> {
  if (!viewset) return {};
  const raw = viewset as unknown as Record<string, unknown>;
  return omitKey(raw, 'views');
}

function viewMeta(view: ViewSpec | undefined): Record<string, unknown> {
  if (!view) return {};
  const raw = view as unknown as Record<string, unknown>;
  return omitKey(raw, 'fields');
}

/**
 * Ordered form ids: left visible_types order first, then remaining left keys, then right-only (alphabetical).
 */
function orderedFormIds(left: UiSpecification, right: UiSpecification): string[] {
  const leftOrder = getOrderedViewsetIds(left);
  const rightOrder = getOrderedViewsetIds(right);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of leftOrder) {
    if (left.viewsets[id] && !seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  for (const id of rightOrder) {
    if (right.viewsets[id] && !seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  const extras = Object.keys(right.viewsets).filter(id => !seen.has(id));
  extras.sort();
  out.push(...extras);
  return out;
}

/**
 * Compute hierarchical diff between two normalized UI specifications.
 */
export function computeSurveyDiff(left: UiSpecification, right: UiSpecification): SurveyDiffResult {
  const viewsL = getViewsMap(left);
  const viewsR = getViewsMap(right);
  const formIds = orderedFormIds(left, right);
  const forms: FormDiffNode[] = [];

  for (const formId of formIds) {
    const vsL = left.viewsets[formId];
    const vsR = right.viewsets[formId];
    const displayLeft = vsL ? viewsetDisplayLabel(left, formId) : '—';
    const displayRight = vsR ? viewsetDisplayLabel(right, formId) : '—';

    if (!vsL && vsR) {
      forms.push(buildAddedForm(formId, displayRight, right, viewsR, vsR));
      continue;
    }
    if (vsL && !vsR) {
      forms.push(buildRemovedForm(formId, displayLeft, left, viewsL, vsL));
      continue;
    }
    if (!vsL || !vsR) continue;

    const metaChanges = diffValues(viewsetMeta(vsL), viewsetMeta(vsR), 'viewset');
    const idsL = normalizeViewIdList(vsL.views);
    const idsR = normalizeViewIdList(vsR.views);
    const { sameSet, sameOrder } = sameSetOrder(idsL, idsR);
    const sectionOrderChanged = sameSet && !sameOrder;

    const sections = diffSectionsForForm(left, right, viewsL, viewsR, idsL, idsR);

    const hasSectionChange = sections.some(s => s.status !== 'unchanged');
    const status: DiffStatus =
      metaChanges.length > 0 || sectionOrderChanged || hasSectionChange ? 'modified' : 'unchanged';

    forms.push({
      formId,
      displayLeft,
      displayRight,
      status,
      metaChanges: metaChanges.length ? metaChanges : undefined,
      sectionOrderChanged: sectionOrderChanged || undefined,
      sections,
    });
  }

  return { forms, generatedAt: new Date().toISOString() };
}

function buildAddedForm(
  formId: string,
  displayRight: string,
  spec: UiSpecification,
  viewsMap: ReturnType<typeof getViewsMap>,
  vs: ViewsetSpec
): FormDiffNode {
  const viewIds = normalizeViewIdList(vs.views);
  const sections: SectionDiffNode[] = [];
  for (const sectionId of viewIds) {
    const view = viewsMap[sectionId];
    const fields = view ? normalizeFieldNameList(view.fields) : [];
    const questions: QuestionDiffNode[] = fields.map(fieldId => ({
      fieldId,
      displayLeft: '—',
      displayRight: fieldDisplay(spec, fieldId),
      status: 'added' as const,
    }));
    sections.push({
      sectionId,
      displayLeft: '—',
      displayRight: view?.label ?? sectionId,
      status: 'added',
      questions,
    });
  }
  return {
    formId,
    displayLeft: '—',
    displayRight,
    status: 'added',
    sections,
  };
}

function buildRemovedForm(
  formId: string,
  displayLeft: string,
  spec: UiSpecification,
  viewsMap: ReturnType<typeof getViewsMap>,
  vs: ViewsetSpec
): FormDiffNode {
  const viewIds = normalizeViewIdList(vs.views);
  const sections: SectionDiffNode[] = [];
  for (const sectionId of viewIds) {
    const view = viewsMap[sectionId];
    const fields = view ? normalizeFieldNameList(view.fields) : [];
    const questions: QuestionDiffNode[] = fields.map(fieldId => ({
      fieldId,
      displayLeft: fieldDisplay(spec, fieldId),
      displayRight: '—',
      status: 'removed' as const,
    }));
    sections.push({
      sectionId,
      displayLeft: view?.label ?? sectionId,
      displayRight: '—',
      status: 'removed',
      questions,
    });
  }
  return {
    formId,
    displayLeft,
    displayRight: '—',
    status: 'removed',
    sections,
  };
}

function diffSectionsForForm(
  left: UiSpecification,
  right: UiSpecification,
  viewsL: ReturnType<typeof getViewsMap>,
  viewsR: ReturnType<typeof getViewsMap>,
  idsL: string[],
  idsR: string[]
): SectionDiffNode[] {
  const inR = new Set(idsR);
  const inL = new Set(idsL);
  const sections: SectionDiffNode[] = [];

  for (const sectionId of idsL) {
    if (!inR.has(sectionId)) {
      const view = viewsL[sectionId];
      const fields = view ? normalizeFieldNameList(view.fields) : [];
      sections.push({
        sectionId,
        displayLeft: view?.label ?? sectionId,
        displayRight: '—',
        status: 'removed',
        questions: fields.map(fieldId => ({
          fieldId,
          displayLeft: fieldDisplay(left, fieldId),
          displayRight: '—',
          status: 'removed' as const,
        })),
      });
      continue;
    }

    const vL = left.fviews?.[sectionId] ?? left.views?.[sectionId];
    const vR = right.fviews?.[sectionId] ?? right.views?.[sectionId];
    const metaChanges = diffValues(viewMeta(vL), viewMeta(vR), 'section');
    const fL = normalizeFieldNameList(vL?.fields);
    const fR = normalizeFieldNameList(vR?.fields);
    const { sameSet, sameOrder } = sameSetOrder(fL, fR);
    const fieldOrderChanged = sameSet && !sameOrder;

    const questions = diffQuestionsForSection(left, right, fL, fR);
    const hasQ = questions.some(q => q.status !== 'unchanged');
    const status: DiffStatus =
      metaChanges.length > 0 || fieldOrderChanged || hasQ ? 'modified' : 'unchanged';

    sections.push({
      sectionId,
      displayLeft: viewDisplayLabel(left, sectionId),
      displayRight: viewDisplayLabel(right, sectionId),
      status,
      metaChanges: metaChanges.length ? metaChanges : undefined,
      fieldOrderChanged: fieldOrderChanged || undefined,
      questions,
    });
  }

  for (const sectionId of idsR) {
    if (inL.has(sectionId)) continue;
    const view = viewsR[sectionId];
    const fields = view ? normalizeFieldNameList(view.fields) : [];
    sections.push({
      sectionId,
      displayLeft: '—',
      displayRight: view?.label ?? sectionId,
      status: 'added',
      questions: fields.map(fieldId => ({
        fieldId,
        displayLeft: '—',
        displayRight: fieldDisplay(right, fieldId),
        status: 'added' as const,
      })),
    });
  }

  return sections;
}

function diffQuestionsForSection(
  left: UiSpecification,
  right: UiSpecification,
  fL: string[],
  fR: string[]
): QuestionDiffNode[] {
  const inR = new Set(fR);
  const inL = new Set(fL);
  const questions: QuestionDiffNode[] = [];

  for (const fieldId of fL) {
    if (!inR.has(fieldId)) {
      questions.push({
        fieldId,
        displayLeft: fieldDisplay(left, fieldId),
        displayRight: '—',
        status: 'removed',
      });
      continue;
    }
    const specL = left.fields[fieldId];
    const specR = right.fields[fieldId];
    const changes = diffValues(specL, specR, 'field');
    const status: DiffStatus = changes.length > 0 ? 'modified' : 'unchanged';
    questions.push({
      fieldId,
      displayLeft: fieldDisplay(left, fieldId),
      displayRight: fieldDisplay(right, fieldId),
      status,
      changes: changes.length ? changes : undefined,
    });
  }

  for (const fieldId of fR) {
    if (inL.has(fieldId)) continue;
    questions.push({
      fieldId,
      displayLeft: '—',
      displayRight: fieldDisplay(right, fieldId),
      status: 'added',
    });
  }

  return questions;
}

/** Human-readable markdown summary, grouped by form and section */
export function surveyDiffToMarkdown(result: SurveyDiffResult, title = 'Survey specification changes'): string {
  const lines: string[] = [`# ${title}`, '', `_Generated: ${result.generatedAt}_`, ''];

  let anyChange = false;
  for (const form of result.forms) {
    if (form.status === 'unchanged') continue;
    anyChange = true;
    const formTitle =
      form.status === 'added'
        ? `Form added: **${form.displayRight}** (\`${form.formId}\`)`
        : form.status === 'removed'
          ? `Form removed: **${form.displayLeft}** (\`${form.formId}\`)`
          : `Form modified: **${form.displayLeft}** → **${form.displayRight}** (\`${form.formId}\`)`;
    lines.push(`## ${formTitle}`, '');

    if (form.metaChanges?.length) {
      lines.push('### Viewset metadata', '');
      for (const c of form.metaChanges) {
        lines.push(`- \`${c.path}\`: ${formatValueForDisplay(c.before)} → ${formatValueForDisplay(c.after)}`);
      }
      lines.push('');
    }
    if (form.sectionOrderChanged) {
      lines.push('- Section order changed within this form.', '');
    }

    for (const sec of form.sections) {
      if (sec.status === 'unchanged') continue;
      const secHeading =
        sec.status === 'added'
          ? `### Section added: **${sec.displayRight}** (\`${sec.sectionId}\`)`
          : sec.status === 'removed'
            ? `### Section removed: **${sec.displayLeft}** (\`${sec.sectionId}\`)`
            : `### Section: **${sec.displayLeft}** / **${sec.displayRight}** (\`${sec.sectionId}\`)`;
      lines.push(secHeading, '');

      if (sec.metaChanges?.length) {
        for (const c of sec.metaChanges) {
          lines.push(`- _Section field_ \`${c.path}\`: ${formatValueForDisplay(c.before)} → ${formatValueForDisplay(c.after)}`);
        }
        lines.push('');
      }
      if (sec.fieldOrderChanged) {
        lines.push('- Question order changed within this section.', '');
      }

      const added = sec.questions.filter(q => q.status === 'added');
      const removed = sec.questions.filter(q => q.status === 'removed');
      const modified = sec.questions.filter(q => q.status === 'modified');

      if (removed.length) {
        lines.push('**Removed questions**', '');
        for (const q of removed) {
          lines.push(`- \`${q.fieldId}\` — ${q.displayLeft}`);
        }
        lines.push('');
      }
      if (added.length) {
        lines.push('**Added questions**', '');
        for (const q of added) {
          lines.push(`- \`${q.fieldId}\` — ${q.displayRight}`);
        }
        lines.push('');
      }
      if (modified.length) {
        lines.push('**Modified questions**', '');
        for (const q of modified) {
          lines.push(`- \`${q.fieldId}\` — ${q.displayLeft} / ${q.displayRight}`);
          if (q.changes?.length) {
            for (const c of q.changes.slice(0, 15)) {
              lines.push(`  - \`${c.path}\`: ${formatValueForDisplay(c.before)} → ${formatValueForDisplay(c.after)}`);
            }
            if (q.changes.length > 15) {
              lines.push(`  - _…and ${q.changes.length - 15} more paths_`);
            }
          }
        }
        lines.push('');
      }
    }
  }

  if (!anyChange) {
    lines.push('No structural or field-level differences detected.', '');
  }

  return lines.join('\n').trimEnd() + '\n';
}
