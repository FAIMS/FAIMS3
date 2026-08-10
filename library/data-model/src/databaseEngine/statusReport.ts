import {z} from 'zod';
import {ENCODING_SEPARATOR} from '../constants';
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

// Caps concurrent CouchDB fetches across the whole walk, so a wide or
// diamond-shaped child graph cannot exhaust the API's connection pool
const STATUS_REPORT_FETCH_CONCURRENCY = 10;

/** FIFO semaphore; a slot is held only across one fetch, never across recursion. */
class FetchLimiter {
  private active = 0;
  private queue: Array<() => void> = [];
  constructor(private readonly limit: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active < this.limit) {
      this.active++;
    } else {
      // The releasing task hands its slot straight to us
      await new Promise<void>(resolve => this.queue.push(resolve));
    }
    try {
      return await fn();
    } finally {
      const next = this.queue.shift();
      if (next) {
        next();
      } else {
        this.active--;
      }
    }
  }
}

// Stored link values tolerate absent/partial legacy vocab pairs. Local to the
// report on purpose: the shared schema stays strict so the export stripper
// keeps leaving unparseable legacy fields untouched.
const storedLinkEntrySchema = relatedRecordFieldAvpEntrySchema.extend({
  relation_type_vocabPair: z.array(z.string()).optional(),
});

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
  /**
   * Roll-up fraction 0->1: (own progress + sum of live child progress) /
   * (1 + distinct live children + required-but-empty child fields).
   */
  progress: number;
  ownProgress: CompletionResult;
  /** Raw values of the form's currently visible summary_fields, keyed by field name. */
  summaryValues: Record<string, unknown>;
  childFields: RecordStatusChildField[];
  /**
   * Child record ids excluded from the roll-up (deleted, cycle, cross-project,
   * unreadable, malformed link). Ids are safe to expose: they already appear in the parent's
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
  limiter: FetchLimiter;
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
} & Omit<WalkContext, 'engine' | 'limiter'>): Promise<RecordStatusReport> {
  const ctx: WalkContext = {
    engine,
    projectId,
    recordFilter,
    isCompleteResolver,
    limiter: new FetchLimiter(STATUS_REPORT_FETCH_CONCURRENCY),
  };
  const head = await ctx.limiter.run(() => resolveLiveHead(ctx, recordId));
  if (head === null) {
    throw new RecordDeletedError(recordId);
  }
  return walk(ctx, recordId, head.selectedHead, new Set(), 0);
}

/**
 * Cheap record/revision head gate run before each node's walk and by the
 * depth-cap liveness check; null when the record is deleted or filtered out.
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
 * Guards only a child's head resolution: dangling or corrupt children (missing
 * record/revision docs, empty heads) are skipped like deleted ones. Errors
 * past the head gate (e.g. a live child with a missing AVP) must surface
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
 * linked child ids. Cycle, cross-project and malformed-but-identifiable links
 * land in `skipped`; each entry is judged individually so one bad link cannot
 * hide its siblings.
 */
function collectChildFields(
  ctx: WalkContext,
  visibilityMap: FieldVisibilityMap,
  data: FormUpdateData | undefined,
  ancestors: ReadonlySet<string>,
  skipped: Set<string>
): CollectedChildField[] {
  const collected: CollectedChildField[] = [];
  // Set: a field listed in two visible sections is still one child field
  for (const fieldId of new Set(Object.values(visibilityMap).flat())) {
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
      const entry = storedLinkEntrySchema.safeParse(rawEntry);
      if (!entry.success) {
        // Trace an unreadable link whenever an id is recoverable, so it
        // cannot vanish from the report without a skippedChildren marker
        const rawId =
          typeof rawEntry === 'string'
            ? rawEntry
            : (rawEntry as {record_id?: unknown} | null)?.record_id;
        if (typeof rawId === 'string' && rawId.length > 0) {
          skipped.add(rawId);
        }
        continue;
      }
      const {record_id: childId, project_id: linkProjectId} = entry.data;
      // Legacy app versions stored the system-wide id (listing||notebook);
      // only the notebook part is comparable to the API's bare project id
      const linkNotebookId = linkProjectId?.split(ENCODING_SEPARATOR).pop();
      if (
        (linkNotebookId !== undefined && linkNotebookId !== ctx.projectId) ||
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

/** One node of the walk; the caller has already resolved the live head. */
async function walk(
  ctx: WalkContext,
  recordId: string,
  revisionId: string,
  ancestors: ReadonlySet<string>,
  depth: number
): Promise<RecordStatusReport> {
  const {engine} = ctx;

  const {formId, data, context} = await ctx.limiter.run(() =>
    engine.form.getExistingFormData({
      recordId,
      revisionId,
    })
  );

  // Unknown form type: report a complete leaf rather than crash downstream.
  // hasOwnProperty, since `in` also matches prototype keys ('constructor')
  if (!Object.prototype.hasOwnProperty.call(engine.uiSpec.viewsets, formId)) {
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
      // null, since JSON serialization would drop an undefined value's key
      summaryValues[fieldName] = data?.[fieldName]?.data ?? null;
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
        const childHead = await ctx.limiter
          .run(() => resolveLiveHead(ctx, childId))
          .catch(absorbSkippableChildError);
        live.set(childId, childHead !== null);
      })
    );
    for (const childId of distinctIds) {
      if (!live.get(childId)) {
        skipped.add(childId);
      }
    }
    const capFields = collected.map(field =>
      toChildField(field, field.childIds.filter(id => live.get(id)).length, [])
    );
    const ownProgress = adjustOwnProgressForChildren(rawOwnProgress, capFields);
    return {
      ...base,
      ownProgress,
      progress: ownProgress.progress,
      childFields: [],
      ...(skipped.size > 0 ? {skippedChildren: [...skipped]} : {}),
      truncated: true,
    };
  }

  // One walk per distinct child, so a child linked from several fields is
  // fetched once and counts as one roll-up unit
  const reports = new Map<string, RecordStatusReport | null>();
  await Promise.all(
    distinctIds.map(async childId => {
      const childHead = await ctx.limiter
        .run(() => resolveLiveHead(ctx, childId))
        .catch(absorbSkippableChildError);
      reports.set(
        childId,
        childHead === null
          ? null
          : await walk(
              ctx,
              childId,
              childHead.selectedHead,
              nextAncestors,
              depth + 1
            )
      );
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
