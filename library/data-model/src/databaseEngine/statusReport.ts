import {
  currentlyVisibleMap,
  getSummaryFieldInformation,
} from '../uiSpecification/utils';
import {
  completion,
  CompletionResult,
  FieldVisibilityMap,
  formDataToValues,
  IsCompleteResolver,
} from './completion';
import {DataEngine} from './engine';
import {
  DocumentNotFoundError,
  NoHeadsError,
  RecordDeletedError,
} from './exceptions';
import {
  FormUpdateData,
  relatedRecordFieldAvpEntrySchema,
  relatedRecordSelectorComponentParamsSchema,
} from './types';

/** Component type whose field values hold forward links to related records. */
export const RELATED_RECORD_SELECTOR = {
  namespace: 'faims-custom',
  name: 'RelatedRecordSelector',
} as const;

// Backstop against corrupt/pathological deep data; real trees are ~4 levels
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
  /** Roll-up fraction 0->1: (own progress + sum of child progress) / (1 + expected children). */
  progress: number;
  ownProgress: CompletionResult;
  /** Raw values of the form's currently visible summary_fields, keyed by field name. */
  summaryValues: Record<string, unknown>;
  childFields: RecordStatusChildField[];
  /**
   * Child record ids excluded from the roll-up (deleted, cycle, cross-project,
   * unreadable). Ids are safe to expose: they already appear in the parent's
   * own readable field data, and the cause of each skip is deliberately
   * indistinguishable.
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
  projectId: string;
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
 * left out of both numerator and denominator, so the fraction means
 * "completion of what this viewer can see" and may differ between viewers. A
 * required Child field counts complete in the record's own progress only while
 * it has at least one live child, so a link to a deleted or dangling record
 * scores no better than an empty field.
 *
 * @param engine - Data engine for the project's data database
 * @param recordId - Root record to report on
 * @param projectId - Project the walk is scoped to; links tagged with another
 *   project id are skipped
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

/**
 * Cheap record/revision head gate shared by the walk and the depth-cap
 * liveness check; null when the record is deleted or filtered out.
 */
async function resolveLiveHead(
  ctx: WalkContext,
  recordId: string
): Promise<{selectedHead: string} | null> {
  const record = await ctx.engine.core.getRecord(recordId);
  const {selectedHead} = ctx.engine.core.resolveHead({
    recordId,
    heads: record.heads,
    behavior: 'pickFirst',
  });
  const revision = await ctx.engine.core.getRevision(selectedHead);
  if (revision.deleted) {
    return null;
  }
  if (
    ctx.recordFilter &&
    !ctx.recordFilter({recordId, createdBy: record.created_by})
  ) {
    return null;
  }
  return {selectedHead};
}

/**
 * Dangling or corrupt children (missing docs, empty heads) are skipped like
 * deleted ones; anything else (connectivity, invalid documents) must surface
 * rather than silently skew the report.
 */
function absorbSkippableChildError(err: unknown): null {
  if (err instanceof DocumentNotFoundError || err instanceof NoHeadsError) {
    return null;
  }
  throw err;
}

interface CollectedChildField {
  fieldId: string;
  relatedFormId: string;
  required: boolean;
  /** Distinct linked child ids; cycle and cross-project links excluded. */
  childIds: string[];
}

/**
 * Reads the record's visible Child-type RelatedRecordSelector fields and their
 * linked child ids. Cycle and cross-project links land in `skipped`; malformed
 * entries are dropped individually so one bad link cannot hide its siblings.
 */
function collectChildFields(
  ctx: WalkContext,
  visibilityMap: FieldVisibilityMap,
  data: FormUpdateData | undefined,
  ancestors: ReadonlySet<string>,
  skipped: Set<string>
): CollectedChildField[] {
  const collected: CollectedChildField[] = [];
  for (const fieldId of Object.values(visibilityMap).flat()) {
    const fieldSpec = ctx.engine.uiSpec.fields[fieldId];
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

    const raw = data?.[fieldId]?.data;
    const rawEntries = Array.isArray(raw)
      ? raw
      : raw === null || raw === undefined
        ? []
        : [raw];
    const childIds: string[] = [];
    for (const rawEntry of rawEntries) {
      const entry = relatedRecordFieldAvpEntrySchema.safeParse(rawEntry);
      if (!entry.success) {
        continue;
      }
      const {record_id: childId, project_id: linkProjectId} = entry.data;
      if (
        (linkProjectId !== undefined && linkProjectId !== ctx.projectId) ||
        ancestors.has(childId)
      ) {
        skipped.add(childId);
        continue;
      }
      // A duplicate link to the same child is still one child
      if (!childIds.includes(childId)) {
        childIds.push(childId);
      }
    }
    collected.push({
      fieldId,
      relatedFormId: params.data.related_type,
      required: !!fieldSpec['component-parameters']?.required,
      childIds,
    });
  }
  return collected;
}

/** Builds the reported child-field entry from a collected field. */
function toChildField(
  field: CollectedChildField,
  createdCount: number,
  children: RecordStatusReport[]
): RecordStatusChildField {
  return {
    fieldId: field.fieldId,
    relatedFormId: field.relatedFormId,
    required: field.required,
    createdCount,
    expectedCount: createdCount > 0 ? createdCount : field.required ? 1 : 0,
    children,
  };
}

/** One node of the walk; null when the record is deleted or filtered out. */
async function walk(
  ctx: WalkContext,
  recordId: string,
  ancestors: ReadonlySet<string>,
  depth: number
): Promise<RecordStatusReport | null> {
  const {engine} = ctx;

  const head = await resolveLiveHead(ctx, recordId);
  if (head === null) {
    return null;
  }

  const {formId, data, context} = await engine.form.getExistingFormData({
    recordId,
    revisionId: head.selectedHead,
  });

  // Unknown form type: report a complete leaf rather than crash downstream
  if (!(formId in engine.uiSpec.viewsets)) {
    return {
      recordId,
      hrid: context.hrid,
      formId,
      progress: 1.0,
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

  // Hidden summary fields may hold stale values, so only visible ones report
  const visibleFields = new Set(Object.values(visibilityMap).flat());
  const summaryValues: Record<string, unknown> = {};
  for (const fieldName of getSummaryFieldInformation(engine.uiSpec, formId)
    .fieldNames) {
    if (visibleFields.has(fieldName)) {
      summaryValues[fieldName] = data?.[fieldName]?.data;
    }
  }

  const base = {
    recordId,
    hrid: context.hrid,
    formId,
    summaryValues,
  };

  const skipped = new Set<string>();
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(recordId);
  const collected = collectChildFields(
    ctx,
    visibilityMap,
    data,
    nextAncestors,
    skipped
  );
  const distinctIds = [...new Set(collected.flatMap(field => field.childIds))];

  // At the cap children still gate required-field completion (via a
  // recursion-free liveness check) so a truncated node reports the same own
  // progress as an untruncated one; only the child detail is dropped
  if (depth >= STATUS_REPORT_MAX_DEPTH) {
    const live = new Map<string, boolean>();
    await Promise.all(
      distinctIds.map(async childId => {
        const childHead = await resolveLiveHead(ctx, childId).catch(
          absorbSkippableChildError
        );
        live.set(childId, childHead !== null);
      })
    );
    const capFields = collected.map(field =>
      toChildField(field, field.childIds.filter(id => live.get(id)).length, [])
    );
    const ownProgress = adjustOwnProgressForChildren(rawOwnProgress, capFields);
    return {
      ...base,
      ownProgress,
      progress: ownProgress.progress,
      childFields: [],
      truncated: true,
    };
  }

  // One walk per distinct child, so a child linked from several fields is
  // fetched once and counts as one roll-up unit
  const reports = new Map<string, RecordStatusReport | null>();
  await Promise.all(
    distinctIds.map(async childId => {
      const report = await walk(ctx, childId, nextAncestors, depth + 1).catch(
        absorbSkippableChildError
      );
      reports.set(childId, report);
    })
  );

  const childFields = collected.map(field => {
    const children = field.childIds
      .map(id => reports.get(id))
      .filter((child): child is RecordStatusReport => !!child);
    for (const id of field.childIds) {
      if (!reports.get(id)) {
        skipped.add(id);
      }
    }
    return toChildField(field, children.length, children);
  });

  const ownProgress = adjustOwnProgressForChildren(rawOwnProgress, childFields);

  // Each distinct live child is one unit alongside the record's own form; a
  // required field with no children expects one empty unit
  const liveIds = distinctIds.filter(id => reports.get(id));
  const units =
    liveIds.length +
    childFields.filter(field => field.required && field.createdCount === 0)
      .length;
  const childProgressSum = liveIds.reduce(
    (sum, id) => sum + reports.get(id)!.progress,
    0
  );
  const progress =
    units === 0
      ? ownProgress.progress
      : (ownProgress.progress + childProgressSum) / (1 + units);

  return {
    ...base,
    ownProgress,
    progress,
    childFields,
    ...(skipped.size > 0 ? {skippedChildren: [...skipped]} : {}),
  };
}
