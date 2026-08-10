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
  DocumentValidationError,
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

// Caps concurrent record hydrations across the whole walk; each hydration
// still fans out one AVP fetch per field, so in-flight CouchDB requests scale
// with form size rather than tree size
const STATUS_REPORT_FETCH_CONCURRENCY = 10;

/** FIFO semaphore; a slot is held only across one record's hydration, never across recursion. */
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
   * Child ids excluded from the roll-up (deleted, cycle, cross-project,
   * unreadable, malformed, unknown form; the cause is deliberately
   * indistinguishable). Safe to expose: they already appear in the parent's
   * own readable field data.
   */
  skippedChildren?: string[];
  /** True when the depth cap stopped recursion here: child counts remain, child reports are dropped. */
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
  /** Settled reports, shared walk-wide so a child linked from several records is computed once. */
  memo: Map<string, RecordStatusReport | null>;
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
 * scores no better than an empty field. A child whose documents are missing or
 * corrupt is skipped and listed in `skippedChildren`, so one bad child cannot
 * fail the whole report; the same faults on the root record still throw.
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
} & Omit<
  WalkContext,
  'engine' | 'limiter' | 'memo'
>): Promise<RecordStatusReport> {
  const ctx: WalkContext = {
    engine,
    projectId,
    recordFilter,
    isCompleteResolver,
    limiter: new FetchLimiter(STATUS_REPORT_FETCH_CONCURRENCY),
    memo: new Map(),
  };
  const report = await walk(ctx, recordId, new Set(), 0);
  if (report === null) {
    throw new RecordDeletedError(recordId);
  }
  return report;
}

/**
 * Recursion-free record-level liveness check used at the depth cap, where
 * children still gate required-field completion but are not hydrated.
 */
async function isLiveRecord(
  ctx: WalkContext,
  recordId: string
): Promise<boolean> {
  const record = await ctx.engine.core.getRecord(recordId);
  const {selectedHead} = ctx.engine.core.resolveHead({
    recordId,
    heads: record.heads,
    behavior: 'pickFirst',
  });
  const revision = await ctx.engine.core.getRevision(selectedHead);
  if (revision.deleted) {
    return false;
  }
  if (
    ctx.recordFilter &&
    !ctx.recordFilter({recordId, createdBy: record.created_by})
  ) {
    return false;
  }
  return true;
}

/**
 * Converts one child's failure to load into a skip: dangling or corrupt
 * children (missing record/revision/AVP docs, empty heads, schema-invalid
 * docs) land in skippedChildren rather than failing the whole report. The
 * same errors on the root record still surface to the caller.
 */
function absorbSkippableChildError(err: unknown): null {
  if (
    err instanceof DocumentNotFoundError ||
    err instanceof NoHeadsError ||
    err instanceof DocumentValidationError
  ) {
    return null;
  }
  throw err;
}

/**
 * Best-effort child id from an unparseable link entry (a bare id string, or
 * an entry whose record_id survived as a string), for skippedChildren tracing.
 */
function recoverLinkId(rawEntry: unknown): string | null {
  const rawId =
    typeof rawEntry === 'string'
      ? rawEntry
      : (rawEntry as {record_id?: unknown} | null)?.record_id;
  return typeof rawId === 'string' && rawId.length > 0 ? rawId : null;
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
    const raw = data?.[fieldId]?.data;
    const rawEntries = Array.isArray(raw)
      ? raw
      : raw === null || raw === undefined
        ? []
        : [raw];

    const params = relatedRecordSelectorComponentParamsSchema.safeParse(
      fieldSpec['component-parameters']
    );
    if (!params.success) {
      // Unparseable params: unless the field is explicitly Linked, trace its
      // linked ids as skipped so the subtree cannot vanish without a marker
      if (
        fieldSpec['component-parameters']?.relation_type !==
        'faims-core::Linked'
      ) {
        for (const rawEntry of rawEntries) {
          const rawId = recoverLinkId(rawEntry);
          if (rawId !== null) {
            skipped.add(rawId);
          }
        }
      }
      continue;
    }
    if (params.data.relation_type !== 'faims-core::Child') {
      continue;
    }

    const childIds: string[] = [];
    for (const rawEntry of rawEntries) {
      const entry = storedLinkEntrySchema.safeParse(rawEntry);
      if (!entry.success) {
        // Trace an unreadable link whenever an id is recoverable, so it
        // cannot vanish from the report without a skippedChildren marker
        const rawId = recoverLinkId(rawEntry);
        if (rawId !== null) {
          skipped.add(rawId);
        }
        continue;
      }
      const {record_id: childId, project_id: linkProjectId} = entry.data;
      // Legacy app versions stored the system-wide id (listing||notebook);
      // only the notebook part is comparable to the API's bare project id.
      // An empty-string tag means untagged, like an absent one
      const linkNotebookId = linkProjectId
        ? linkProjectId.split(ENCODING_SEPARATOR).pop()
        : undefined;
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

/**
 * Memoized walk: a child linked from several records is computed once and its
 * report shared. Only settled results are reused — awaiting another branch's
 * in-flight promise could deadlock on mutually-linked records — and truncated
 * reports stay uncached because they are depth-specific.
 */
async function walk(
  ctx: WalkContext,
  recordId: string,
  ancestors: ReadonlySet<string>,
  depth: number
): Promise<RecordStatusReport | null> {
  const cached = ctx.memo.get(recordId);
  if (cached !== undefined) {
    return cached;
  }
  const report = await walkNode(ctx, recordId, ancestors, depth);
  if (!report?.truncated) {
    ctx.memo.set(recordId, report);
  }
  return report;
}

/**
 * One node of the walk: a single hydration fetches the record, head revision
 * and AVPs together; null when the record is deleted or filtered out.
 */
async function walkNode(
  ctx: WalkContext,
  recordId: string,
  ancestors: ReadonlySet<string>,
  depth: number
): Promise<RecordStatusReport | null> {
  const {engine} = ctx;

  const {formId, data, context} = await ctx.limiter.run(() =>
    engine.form.getExistingFormData({
      recordId,
      config: {conflictBehaviour: 'pickFirst'},
    })
  );
  if (context.revision.deleted) {
    return null;
  }
  if (
    ctx.recordFilter &&
    !ctx.recordFilter({recordId, createdBy: context.record.createdBy})
  ) {
    return null;
  }

  // Unknown form type (e.g. the form was removed from the notebook): progress
  // is unmeasurable, so a child is skipped like a deleted one; the root still
  // reports a bare leaf rather than erroring. hasOwnProperty, since `in` also
  // matches prototype keys ('constructor')
  if (!Object.prototype.hasOwnProperty.call(engine.uiSpec.viewsets, formId)) {
    if (depth > 0) {
      return null;
    }
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

  // One walk per distinct child, so a child linked from several fields is
  // fetched once and counts as one roll-up unit. At the cap children are not
  // hydrated: a recursion-free liveness check still gates required-field
  // completion, but they carry no report and so no roll-up unit
  const atCap = depth >= STATUS_REPORT_MAX_DEPTH;
  const reports = new Map<string, RecordStatusReport | null>();
  const live = new Map<string, boolean>();
  await Promise.all(
    distinctIds.map(async childId => {
      if (atCap) {
        const alive = await ctx.limiter
          .run(() => isLiveRecord(ctx, childId))
          .catch(absorbSkippableChildError);
        live.set(childId, alive === true);
      } else {
        const childReport = await walk(
          ctx,
          childId,
          nextAncestors,
          depth + 1
        ).catch(absorbSkippableChildError);
        reports.set(childId, childReport);
        live.set(childId, childReport !== null);
      }
    })
  );

  // A child both live and skipped (a duplicate link tagged with another
  // project) reports as live only
  for (const childId of distinctIds) {
    if (live.get(childId)) {
      skipped.delete(childId);
    } else {
      skipped.add(childId);
    }
  }

  const childFields = collected.map(field => {
    const liveIds = field.childIds.filter(id => live.get(id));
    const children = liveIds
      .map(id => reports.get(id))
      .filter((child): child is RecordStatusReport => !!child);
    return toChildField(field, liveIds.length, children);
  });

  const ownProgress = adjustOwnProgressForChildren(rawOwnProgress, childFields);

  // Each reported live child is one unit alongside the record's own form; a
  // required field with no children expects one empty unit
  const reportedIds = distinctIds.filter(id => reports.get(id));
  const units =
    reportedIds.length +
    childFields.filter(field => field.required && field.createdCount === 0)
      .length;
  const childProgressSum = reportedIds.reduce(
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
    ...(atCap && distinctIds.length > 0 ? {truncated: true} : {}),
  };
}
