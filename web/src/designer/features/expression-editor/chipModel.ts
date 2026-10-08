// SPDX-License-Identifier: Apache-2.0
/**
 * @file Maps a stored expression `{ref}` to the display model used by chips.
 *
 * The CodeMirror document keeps the raw reference (`{f_a1b2c3}`,
 * `{_CONSTANT.PI}`, …). This module never rewrites that string. It only
 * decides what the chip face and hover tooltip should show: a human label,
 * kind, export name, expression type, and an `error` when the ref is
 * missing or invalid.
 *
 * Classification is {@link resolveRefType} from the data-model. Unknown
 * ids come back as `FIELD` plus `error`, not a separate kind — there is no
 * `UNKNOWN` RefType.
 */

import {
  CREATED_TIME_ID,
  CREATOR_NAME_ID,
  decodeConstantRef,
  decodeMetadataRef,
  decodeParentRef,
  EXPRESSION_CONSTANTS,
  ExprType,
  FAIMS_TYPE_TO_EXPR_TYPE,
  isReferenceableMetadataKey,
  type RefType,
  resolveRefType,
  splitRelatedReference,
} from '@faims3/data-model';
import {getFieldLabel} from '@/lib/conditionUtils';
import type {FieldType} from '../../state/initial';
import {resolveFieldLocation} from '../field-search';

/**
 * Display data for one complete `{ref}` span.
 *
 * `label` is the untruncated face/tooltip text (never wrapped in braces).
 * The chip widget may shorten it; the tooltip always shows this full value.
 */
export type ChipModel = {
  /** Inner reference, e.g. `f_abc`, `_PARENT.f_abc`, `_CONSTANT.PI`. */
  ref: string;
  /** Classification from {@link resolveRefType} (`FIELD` also covers unknown ids). */
  kind: RefType;
  /** Human face text — field label, `Parent › …`, `PI`, etc. */
  label: string;
  /** CSV / GIS column name when the ref is a field. */
  exportName?: string;
  /** Type the compiler would assign this ref. */
  exprType?: ExprType;
  /** `Form › Section` when the field can be located in the uiSpec. */
  location?: string;
  /** Folded numeric value for named constants. */
  constantValue?: number;
  /** Set when the ref is missing, unsafe, or malformed. */
  error?: string;
};

/**
 * Notebook slice needed to resolve labels and existence checks.
 * Built in the computed-field editor from Redux; not a live store.
 */
export type ChipModelContext = {
  /** uiSpec fields keyed by storage id. */
  fields: Record<string, FieldType>;
  /** Sections, for chip location (`Form › Section`). */
  views: Record<string, {label: string; fields: string[]}>;
  /** Forms, for chip location. */
  viewsets: Record<string, {label: string; views: string[]}>;
  /** Custom metadata keys on this notebook (Info panel). */
  customMetadataKeys: ReadonlySet<string> | readonly string[];
};

/**
 * Lookup passed into CodeMirror as a facet. `get` may return `undefined`;
 * the decoration plugin then uses {@link fallbackChipModel}.
 */
export type ChipCatalog = {
  /** Resolve a ref; `undefined` means the plugin should use {@link fallbackChipModel}. */
  get(ref: string): ChipModel | undefined;
};

/** Tooltip / aria heading for each {@link RefType}. */
export const CHIP_KIND_LABELS: Record<RefType, string> = {
  FIELD: 'Field',
  PARENT_FIELD: 'Parent field',
  RELATED_FIELD: 'Linked field',
  METADATA: 'Notebook metadata',
  CONSTANT: 'Constant',
  SYSTEM: 'System',
};

/** Template system ids (`_CREATOR_NAME`, `_CREATED_TIME`) — rare in expressions. */
const SYSTEM_LABELS: Record<string, string> = {
  [CREATOR_NAME_ID]: 'Creator Name',
  [CREATED_TIME_ID]: 'Created Time',
};

/** Compiler type → designer wording (`string` → `text`). */
const EXPR_TYPE_LABELS: Record<ExprType, string> = {
  number: 'number',
  string: 'text',
  boolean: 'yes-no',
};

/**
 * Human label for an expression type, for tooltips.
 *
 * @param type - Compiler type, or undefined when the ref has no mapped type.
 * @returns Designer wording (`text`, `yes-no`) or undefined.
 */
export const exprTypeLabel = (type: ExprType | undefined): string | undefined =>
  type ? EXPR_TYPE_LABELS[type] : undefined;

/** Whether `key` is in the notebook's custom metadata, Set or array. */
const hasMetadataKey = (ctx: ChipModelContext, key: string): boolean => {
  const keys = ctx.customMetadataKeys;
  return keys instanceof Set
    ? keys.has(key)
    : (keys as readonly string[]).includes(key);
};

/**
 * Chip face for a field: designer label, then export name, then `fallback`.
 * Labels are not unique; this is display only.
 */
const fieldFaceLabel = (
  field: FieldType | undefined,
  fallback: string
): string => {
  if (!field) return fallback;
  const label = getFieldLabel(field);
  if (typeof label === 'string' && label.trim() !== '') return label;
  if (field.exportName) return field.exportName;
  return fallback;
};

/**
 * `Form › Section` for a storage id, or just the form, or undefined.
 *
 * @param fieldId - uiSpec field key (not a prefixed ref).
 */
const fieldLocation = (
  fieldId: string,
  ctx: ChipModelContext
): string | undefined => {
  const loc = resolveFieldLocation(fieldId, ctx.views, ctx.viewsets);
  if (loc.viewSetLabel && loc.sectionLabel) {
    return `${loc.viewSetLabel} › ${loc.sectionLabel}`;
  }
  if (loc.viewSetLabel) return loc.viewSetLabel;
  return undefined;
};

/** Compiler type from `type-returned`, or undefined if the field is not referenceable. */
const exprTypeOf = (field: FieldType | undefined): ExprType | undefined =>
  field ? FAIMS_TYPE_TO_EXPR_TYPE[field['type-returned'] ?? ''] : undefined;

/**
 * Chip used when the catalog has no entry so an opaque id never stands alone
 * without an error style.
 *
 * @param ref - Inner `{ref}` text.
 */
export const fallbackChipModel = (ref: string): ChipModel => ({
  ref,
  kind: 'FIELD',
  label: ref,
  error: 'Unknown reference',
});

/**
 * Resolves one expression or template reference to chip display data.
 *
 * Always returns a model. Missing or invalid refs set `error` and keep a
 * readable `label` (often the inner id).
 *
 * @param ref - Inner braces only, e.g. `f_abc` or `_CONSTANT.PI`.
 * @param ctx - Current fields, forms, and metadata keys.
 */
export const buildChipModel = (
  ref: string,
  ctx: ChipModelContext
): ChipModel => {
  const kind = resolveRefType(ref);

  switch (kind) {
    case 'SYSTEM':
      return {
        ref,
        kind,
        label: SYSTEM_LABELS[ref] ?? ref,
      };

    case 'CONSTANT': {
      // `{_CONSTANT.PI}` — name is case-sensitive; unknown names error.
      const name = decodeConstantRef(ref);
      const value = name === null ? undefined : EXPRESSION_CONSTANTS.get(name);
      if (name === null || value === undefined) {
        return {
          ref,
          kind,
          label: name ?? ref,
          error: 'Unknown constant',
        };
      }
      return {
        ref,
        kind,
        label: name,
        exprType: 'number',
        constantValue: value,
      };
    }

    case 'METADATA': {
      // `{_METADATA.siteCode}` — key must be referenceable and exist on the notebook.
      const key = decodeMetadataRef(ref);
      if (key === null) {
        return {ref, kind, label: ref, error: 'Invalid metadata reference'};
      }
      if (!isReferenceableMetadataKey(key)) {
        return {
          ref,
          kind,
          label: key,
          exprType: 'string',
          error: 'This metadata key cannot be referenced',
        };
      }
      if (!hasMetadataKey(ctx, key)) {
        return {
          ref,
          kind,
          label: key,
          exprType: 'string',
          error: 'Metadata key not found on this notebook',
        };
      }
      return {
        ref,
        kind,
        label: `Notebook › ${key}`,
        exprType: 'string',
      };
    }

    case 'PARENT_FIELD': {
      // `{_PARENT.Field-ID}` — Field-ID is on a parent form, looked up in `ctx.fields`.
      const fieldId = decodeParentRef(ref);
      if (fieldId === null) {
        return {ref, kind, label: ref, error: 'Invalid parent reference'};
      }
      const field = ctx.fields[fieldId];
      if (!field) {
        return {
          ref,
          kind,
          label: fieldId,
          error: 'Field not found',
        };
      }
      return {
        ref,
        kind,
        label: `Parent › ${fieldFaceLabel(field, fieldId)}`,
        exportName: field.exportName,
        exprType: exprTypeOf(field),
        location: fieldLocation(fieldId, ctx),
      };
    }

    case 'RELATED_FIELD': {
      // `{Rel-Field-ID.Field-ID}` — link field on this form, then a field on the linked form.
      const parts = splitRelatedReference(ref);
      if (parts === null) {
        return {ref, kind, label: ref, error: 'Invalid linked-field reference'};
      }
      const relField = ctx.fields[parts.relFieldId];
      const field = ctx.fields[parts.fieldId];
      if (!relField || !field) {
        return {
          ref,
          kind,
          label: ref,
          error: 'Field not found',
        };
      }
      return {
        ref,
        kind,
        label: `${fieldFaceLabel(relField, parts.relFieldId)} › ${fieldFaceLabel(field, parts.fieldId)}`,
        exportName: field.exportName,
        exprType: exprTypeOf(field),
        location: fieldLocation(parts.fieldId, ctx),
      };
    }

    case 'FIELD':
    default: {
      // Bare storage id. `resolveRefType` also lands here for anything unclassified.
      const field = ctx.fields[ref];
      if (!field) {
        return {
          ref,
          kind: 'FIELD',
          label: ref,
          error: 'Field not found',
        };
      }
      return {
        ref,
        kind: 'FIELD',
        label: fieldFaceLabel(field, ref),
        exportName: field.exportName,
        exprType: exprTypeOf(field),
        location: fieldLocation(ref, ctx),
      };
    }
  }
};

/**
 * Memoising {@link ChipCatalog} for the CodeMirror catalog facet.
 *
 * Cache is per catalog instance. Rebuild with a new `ctx` (label rename,
 * field add/delete) so stale models are not reused.
 *
 * @param ctx - Snapshot of fields / views / metadata.
 */
export const createChipCatalog = (ctx: ChipModelContext): ChipCatalog => {
  const cache = new Map<string, ChipModel>();
  return {
    get(ref: string) {
      const cached = cache.get(ref);
      if (cached) return cached;
      const model = buildChipModel(ref, ctx);
      cache.set(ref, model);
      return model;
    },
  };
};
