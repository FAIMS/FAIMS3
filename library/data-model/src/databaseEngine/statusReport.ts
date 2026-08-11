import {ENCODING_SEPARATOR} from '../constants';
import {
  currentlyVisibleMap,
  getSummaryFieldInformation,
} from '../uiSpecification/utils';
import {
  completion,
  completionFromIncomplete,
  CompletionResult,
  formDataToValues,
  IsCompleteResolver,
} from './completion';
import {DataEngine} from './engine';
import {
  DocumentNotFoundError,
  DocumentValidationError,
  NoHeadsError,
  RecordDeletedError,
  UnknownFormTypeError,
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

// Backstop against corrupt/pathological deep data (real trees are ~4 levels);
// it also bounds the response, which repeats a shared subtree once per path
export const STATUS_REPORT_MAX_DEPTH = 10;

// Only the id and project tag matter here, so legacy vocab-pair drift in a
// stored link cannot invalidate a live child
const storedLinkEntrySchema = relatedRecordFieldAvpEntrySchema.pick({
  record_id: true,
  project_id: true,
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
   * (1 + live children + required-but-empty child fields).
   */
  progress: number;
  ownProgress: CompletionResult;
  /** Raw values of the form's currently visible summary_fields, keyed by field name. */
  summaryValues: Record<string, unknown>;
  childFields: RecordStatusChildField[];
  /** True when the depth cap stopped recursion here: link counts remain, child reports are dropped. */
  truncated?: boolean;
}

/**
 * A required Child field is complete only while it has a live child: a stored
 * link (even to a deleted record) satisfies the generic field check and would
 * otherwise score better than an empty field.
 */
function adjustOwnProgressForChildren(
  own: CompletionResult,
  childFields: RecordStatusChildField[]
): CompletionResult {
  const incomplete = new Set(own.incompleteRequired);
  for (const field of childFields) {
    if (!field.required) {
      continue;
    }
    if (field.createdCount > 0) {
      incomplete.delete(field.fieldId);
    } else {
      incomplete.add(field.fieldId);
    }
  }
  return completionFromIncomplete(own.requiredCount, [...incomplete]);
}

interface WalkContext {
  engine: DataEngine;
  projectId: string;
  recordFilter?: (record: {recordId: string; createdBy: string}) => boolean;
  isCompleteResolver?: IsCompleteResolver;
  /** Records on the current walk path; cuts the cycles corrupt data can hold. */
  path: Set<string>;
}

/**
 * Computes the recursive status report for a record: per node the HRID,
 * required-field completion, summary values and the same for child records
 * (faims-core::Child links only). Deleted, unreadable and corrupt children
 * drop out of both sides of the roll-up; cycles in corrupt data are cut where
 * they close and {@link STATUS_REPORT_MAX_DEPTH} truncates anything deeper.
 *
 * @param engine - Data engine for the project's data database
 * @param recordId - Root record to report on
 * @param projectId - Links tagged with another project id are skipped
 * @param recordFilter - Per-record read filter (e.g. API permission check)
 * @param isCompleteResolver - Optional per-field-type completeness override
 * @returns The report tree rooted at recordId
 * @throws RecordDeletedError if the root record is deleted (or filtered out)
 * @throws UnknownFormTypeError if the root's form is not in the ui-spec
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
} & Omit<WalkContext, 'engine' | 'path'>): Promise<RecordStatusReport> {
  const ctx: WalkContext = {
    engine,
    projectId,
    recordFilter,
    isCompleteResolver,
    path: new Set(),
  };
  const report = await walk(ctx, recordId, 0);
  if (report === null) {
    throw new RecordDeletedError(recordId);
  }
  return report;
}

/**
 * Converts one child's failure to load into a skip: a dangling, corrupt or
 * unmeasurable child cannot fail the whole report. The same errors on the
 * root record still surface to the caller.
 */
function absorbSkippableChildError(err: unknown): null {
  if (
    err instanceof DocumentNotFoundError ||
    err instanceof NoHeadsError ||
    err instanceof DocumentValidationError ||
    err instanceof UnknownFormTypeError
  ) {
    return null;
  }
  throw err;
}

interface CollectedChildField {
  fieldId: string;
  relatedFormId: string;
  required: boolean;
  /** Distinct linked child ids; cross-project and malformed links excluded. */
  childIds: string[];
}

/** Reads the visible Child-type RelatedRecordSelector fields and their linked child ids. */
function collectChildFields(
  ctx: WalkContext,
  visibleFields: ReadonlySet<string>,
  data: FormUpdateData | undefined
): CollectedChildField[] {
  const collected: CollectedChildField[] = [];
  for (const fieldId of visibleFields) {
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
        continue;
      }
      const {record_id: childId, project_id: linkProjectId} = entry.data;
      // Legacy app versions stored the system-wide id (listing||notebook);
      // only the notebook part is comparable to the API's bare project id.
      // An empty-string tag means untagged, like an absent one
      const linkNotebookId = linkProjectId
        ? linkProjectId.split(ENCODING_SEPARATOR).pop()
        : undefined;
      if (linkNotebookId !== undefined && linkNotebookId !== ctx.projectId) {
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

/**
 * One node of the walk: a single hydration fetches the record, head revision
 * and AVPs together; null when the record is deleted, filtered out, or would
 * close a cycle (reports under a cut are best-effort and can vary with link
 * order).
 */
async function walk(
  ctx: WalkContext,
  recordId: string,
  depth: number
): Promise<RecordStatusReport | null> {
  if (ctx.path.has(recordId)) {
    return null;
  }
  const {engine} = ctx;

  const {formId, data, context} = await engine.form.getExistingFormData({
    recordId,
    config: {conflictBehaviour: 'pickFirst'},
  });
  if (context.revision.deleted) {
    return null;
  }
  if (
    ctx.recordFilter &&
    !ctx.recordFilter({recordId, createdBy: context.record.createdBy})
  ) {
    return null;
  }
  // hasOwnProperty, since `in` also matches prototype keys ('constructor')
  if (!Object.prototype.hasOwnProperty.call(engine.uiSpec.viewsets, formId)) {
    throw new UnknownFormTypeError(recordId, formId);
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

  // Set: a field listed in two visible sections is still one field
  const visibleFields = new Set(Object.values(visibilityMap).flat());

  // Hidden summary fields may hold stale values, so only visible ones report
  const summaryValues: Record<string, unknown> = {};
  for (const fieldName of getSummaryFieldInformation(engine.uiSpec, formId)
    .fieldNames) {
    if (visibleFields.has(fieldName)) {
      // null, since JSON serialization would drop an undefined value's key
      summaryValues[fieldName] = data?.[fieldName]?.data ?? null;
    }
  }

  const collected = collectChildFields(ctx, visibleFields, data);
  const distinctChildIds = new Set(collected.flatMap(field => field.childIds));

  // At the cap children are not walked: link counts stand in for liveness and
  // carry no reports, so no roll-up units
  const isAtCap = depth >= STATUS_REPORT_MAX_DEPTH;

  // One walk per distinct child, so a child linked from several fields is
  // fetched once and counts as one roll-up unit
  const reports = new Map<string, RecordStatusReport | null>();
  if (!isAtCap) {
    ctx.path.add(recordId);
    try {
      for (const childId of distinctChildIds) {
        let childReport: RecordStatusReport | null;
        try {
          childReport = await walk(ctx, childId, depth + 1);
        } catch (err) {
          childReport = absorbSkippableChildError(err);
        }
        reports.set(childId, childReport);
      }
    } finally {
      ctx.path.delete(recordId);
    }
  }

  const childFields = collected.map((field): RecordStatusChildField => {
    const children = field.childIds
      .map(id => reports.get(id))
      .filter((child): child is RecordStatusReport => !!child);
    const createdCount = isAtCap ? field.childIds.length : children.length;
    return {
      fieldId: field.fieldId,
      relatedFormId: field.relatedFormId,
      required: field.required,
      createdCount,
      expectedCount: createdCount > 0 ? createdCount : field.required ? 1 : 0,
      children,
    };
  });

  const ownProgress = adjustOwnProgressForChildren(rawOwnProgress, childFields);

  // Each live child is one unit alongside the record's own form; a field
  // expecting children but having none contributes one empty unit
  const liveReports = [...reports.values()].filter(
    (child): child is RecordStatusReport => !!child
  );
  const units =
    liveReports.length +
    childFields.filter(
      field => field.expectedCount > 0 && field.createdCount === 0
    ).length;
  const childProgressSum = liveReports.reduce(
    (sum, child) => sum + child.progress,
    0
  );
  const progress =
    units === 0
      ? ownProgress.progress
      : (ownProgress.progress + childProgressSum) / (1 + units);

  return {
    recordId,
    hrid: context.hrid,
    formId,
    progress,
    ownProgress,
    summaryValues,
    childFields,
    ...(isAtCap && distinctChildIds.size > 0 ? {truncated: true} : {}),
  };
}
