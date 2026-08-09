import {
  currentlyVisibleMap,
  getSummaryFieldInformation,
} from '../uiSpecification/utils';
import {
  completion,
  CompletionResult,
  formDataToValues,
  IsCompleteResolver,
} from './completion';
import {DataEngine} from './engine';
import {DocumentNotFoundError, RecordDeletedError} from './exceptions';
import {
  relatedRecordFieldAvpValueSchema,
  relatedRecordSelectorComponentParamsSchema,
} from './types';

/** Component type whose field values hold forward links to related records. */
export const RELATED_RECORD_SELECTOR = {
  namespace: 'faims-custom',
  name: 'RelatedRecordSelector',
} as const;

// Backstop against cycles/corrupt data; real trees are ~4 levels deep
export const STATUS_REPORT_MAX_DEPTH = 10;

/** Status of one Child-type related-record field on a record. */
export interface RecordStatusChildField {
  fieldId: string;
  /** Form the children are created from (`related_type`). */
  relatedFormId: string;
  required: boolean;
  /** Resolvable, non-deleted, non-filtered children. */
  createdCount: number;
  /** createdCount, except a required field with no children expects 1. */
  expectedCount: number;
  children: RecordStatusReport[];
}

/** Recursive completion roll-up for a record and its child records. */
export interface RecordStatusReport {
  recordId: string;
  hrid: string;
  formId: string;
  /** 0->1: (own progress + sum of child percents) / (1 + expected children). */
  percentComplete: number;
  ownProgress: CompletionResult;
  /** Raw values of the form's summary_fields, keyed by field name. */
  summaryValues: Record<string, unknown>;
  childFields: RecordStatusChildField[];
  /**
   * Child record ids excluded from the roll-up (deleted, cycle, unreadable).
   * Ids are safe to expose: they already appear in the parent's own readable
   * field data, and the cause of each skip is deliberately indistinguishable.
   */
  skippedChildren?: string[];
  /** True when the depth cap forced this node to be treated as a leaf. */
  truncated?: boolean;
}

/**
 * Reconciles a record's own completion with its resolved children: a required
 * Child selector field is complete only while it has a live child, because any
 * stored link (even one to a deleted record) satisfies the generic field check
 * and would otherwise score better than an empty field.
 */
function adjustOwnProgressForChildren(
  own: CompletionResult,
  childFields: RecordStatusChildField[]
): CompletionResult {
  let incomplete = own.incompleteRequired;
  for (const field of childFields) {
    if (!field.required) {
      continue;
    }
    const hasLiveChild = field.createdCount > 0;
    const wasIncomplete = incomplete.includes(field.fieldId);
    if (hasLiveChild && wasIncomplete) {
      incomplete = incomplete.filter(id => id !== field.fieldId);
    } else if (!hasLiveChild && !wasIncomplete) {
      incomplete = [...incomplete, field.fieldId];
    }
  }
  if (incomplete === own.incompleteRequired) {
    return own;
  }
  const completedCount = own.requiredCount - incomplete.length;
  return {
    progress:
      own.requiredCount === 0 ? 1.0 : completedCount / own.requiredCount,
    requiredCount: own.requiredCount,
    completedCount,
    incompleteRequired: incomplete,
  };
}

interface WalkContext {
  engine: DataEngine;
  projectId?: string;
  recordFilter?: (record: {recordId: string; createdBy: string}) => boolean;
  isCompleteResolver?: IsCompleteResolver;
}

/**
 * Computes the recursive status report for a record: per node the HRID,
 * required-field completion, summary values and the same for child records.
 * Each record counts as one roll-up unit so a large child form cannot dwarf
 * its parent; a required child field with no records yet counts as one
 * expected child contributing zero progress.
 *
 * Only faims-core::Child relations are followed, discovered from the parent's
 * RelatedRecordSelector field values. Deleted and filter-excluded records are
 * left out of both numerator and denominator, so the percent means "completion
 * of what this viewer can see" and may differ between viewers. A required
 * Child field counts complete in the record's own progress only while it has
 * at least one live child, so a link to a deleted or dangling record scores no
 * better than an empty field.
 *
 * @param engine - Data engine for the project's data database
 * @param recordId - Root record to report on
 * @param projectId - When set, links into other projects are skipped
 * @param recordFilter - Per-record read filter (e.g. API permission check)
 * @param isCompleteResolver - Optional per-field-type completeness override
 * @returns The report tree rooted at recordId
 * @throws RecordDeletedError if the root record is deleted (or filtered out)
 * @throws DocumentNotFoundError if the root record does not exist
 */
export async function computeRecordStatusReport({
  engine,
  recordId,
  projectId,
  recordFilter,
  isCompleteResolver,
}: {
  engine: DataEngine;
  recordId: string;
} & Omit<WalkContext, 'engine'>): Promise<RecordStatusReport> {
  const report = await walk(
    {engine, projectId, recordFilter, isCompleteResolver},
    recordId,
    new Set(),
    0
  );
  if (report === null) {
    throw new RecordDeletedError(recordId);
  }
  return report;
}

/** One node of the walk; null when the record is deleted or filtered out. */
async function walk(
  ctx: WalkContext,
  recordId: string,
  ancestors: ReadonlySet<string>,
  depth: number
): Promise<RecordStatusReport | null> {
  const {engine} = ctx;

  // Cheap head gate before AVP hydration; excluded nodes cost one doc fetch
  const record = await engine.core.getRecord(recordId);
  const {selectedHead} = engine.core.resolveHead({
    recordId,
    heads: record.heads,
    behavior: 'pickFirst',
  });
  const revision = await engine.core.getRevision(selectedHead);
  if (revision.deleted) {
    return null;
  }
  if (
    ctx.recordFilter &&
    !ctx.recordFilter({recordId, createdBy: record.created_by})
  ) {
    return null;
  }

  const {formId, data, context} = await engine.form.getExistingFormData({
    recordId,
    revisionId: selectedHead,
  });

  // Unknown form type: report a complete leaf rather than crash downstream
  if (!(formId in engine.uiSpec.viewsets)) {
    return {
      recordId,
      hrid: context.hrid,
      formId,
      percentComplete: 1.0,
      ownProgress: {
        progress: 1.0,
        requiredCount: 0,
        completedCount: 0,
        incompleteRequired: [],
      },
      summaryValues: {},
      childFields: [],
    };
  }

  const values = formDataToValues(data);
  const visibilityMap = currentlyVisibleMap({
    values,
    uiSpec: engine.uiSpec,
    viewsetId: formId,
  });
  const rawOwnProgress = completion({
    uiSpec: engine.uiSpec,
    formId,
    data,
    visibilityMap,
    isCompleteResolver: ctx.isCompleteResolver,
  });

  const summaryValues: Record<string, unknown> = {};
  for (const fieldName of getSummaryFieldInformation(engine.uiSpec, formId)
    .fieldNames) {
    summaryValues[fieldName] = data?.[fieldName]?.data;
  }

  const base = {
    recordId,
    hrid: context.hrid,
    formId,
    summaryValues,
  };

  // At the cap children are unknown, so own progress stays unreconciled
  if (depth >= STATUS_REPORT_MAX_DEPTH) {
    return {
      ...base,
      ownProgress: rawOwnProgress,
      percentComplete: rawOwnProgress.progress,
      childFields: [],
      truncated: true,
    };
  }

  const skippedChildren: string[] = [];
  const childFields: RecordStatusChildField[] = [];
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(recordId);

  for (const fieldId of Object.values(visibilityMap).flat()) {
    const fieldSpec = engine.uiSpec.fields[fieldId];
    if (
      fieldSpec?.['component-namespace'] !==
        RELATED_RECORD_SELECTOR.namespace ||
      fieldSpec['component-name'] !== RELATED_RECORD_SELECTOR.name
    ) {
      continue;
    }
    const params = relatedRecordSelectorComponentParamsSchema.safeParse(
      fieldSpec['component-parameters']
    );
    if (!params.success || params.data.relation_type !== 'faims-core::Child') {
      continue;
    }

    // Malformed or empty field values mean zero children
    const parsed = relatedRecordFieldAvpValueSchema.safeParse(
      data?.[fieldId]?.data
    );
    const entries = parsed.success
      ? Array.isArray(parsed.data)
        ? parsed.data
        : [parsed.data]
      : [];

    const toRecurse: string[] = [];
    for (const entry of entries) {
      const isCrossProject =
        entry.project_id !== undefined &&
        ctx.projectId !== undefined &&
        entry.project_id !== ctx.projectId;
      if (isCrossProject || nextAncestors.has(entry.record_id)) {
        skippedChildren.push(entry.record_id);
        continue;
      }
      // A duplicate link to the same child is still one child
      if (!toRecurse.includes(entry.record_id)) {
        toRecurse.push(entry.record_id);
      }
    }

    // Dangling references are skipped like deleted ones; anything else
    // (connectivity, corrupt data) must surface rather than skew the report
    const results = await Promise.all(
      toRecurse.map(childId =>
        walk(ctx, childId, nextAncestors, depth + 1).catch(err => {
          if (err instanceof DocumentNotFoundError) return null;
          throw err;
        })
      )
    );
    const children: RecordStatusReport[] = [];
    results.forEach((child, index) => {
      if (child) {
        children.push(child);
      } else {
        skippedChildren.push(toRecurse[index]);
      }
    });

    const required = !!fieldSpec['component-parameters']?.required;
    const createdCount = children.length;
    childFields.push({
      fieldId,
      relatedFormId: params.data.related_type,
      required,
      createdCount,
      expectedCount: createdCount > 0 ? createdCount : required ? 1 : 0,
      children,
    });
  }

  const ownProgress = adjustOwnProgressForChildren(rawOwnProgress, childFields);

  // Each expected child is one unit alongside the record's own form
  const units = childFields.reduce(
    (sum, field) => sum + field.expectedCount,
    0
  );
  const childProgressSum = childFields.reduce(
    (sum, field) =>
      sum +
      field.children.reduce((inner, child) => inner + child.percentComplete, 0),
    0
  );
  const percentComplete =
    units === 0
      ? ownProgress.progress
      : (ownProgress.progress + childProgressSum) / (1 + units);

  return {
    ...base,
    ownProgress,
    percentComplete,
    childFields,
    ...(skippedChildren.length > 0 ? {skippedChildren} : {}),
  };
}
