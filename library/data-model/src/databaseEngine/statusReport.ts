import {
  fieldIdsForViewset,
  getChildRelationParams,
} from '../uiSpecification/parentForms';
import {
  currentlyVisibleFields,
  currentlyVisibleMap,
  getSummaryFieldInformation,
} from '../uiSpecification/utils';
import {
  completion,
  completionFromIncomplete,
  CompletionResult,
  formDataToValues,
  IsCompleteResolver,
  visibleFieldSet,
} from './completion';
import {DataEngine} from './engine';
import {
  DocumentNotFoundError,
  DocumentValidationError,
  NoHeadsError,
  RecordDeletedError,
  UnknownFormTypeError,
} from './exceptions';
import {FormUpdateData, relatedRecordFieldAvpEntrySchema} from './types';

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
  /** Masked to false while the field is hidden, like required-field completion. */
  required: boolean;
  /** Resolvable, non-deleted children. */
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
  /** Raw values of the form's condition-visible summary_fields (statically hidden ones included), keyed by field name. */
  summaryValues: Record<string, unknown>;
  childFields: RecordStatusChildField[];
}

/**
 * A required Child field is complete only while it has a live child: a stored
 * link (even to a deleted record) satisfies the generic field check and would
 * otherwise score better than an empty field. The form's progress bar scores
 * synchronously without this liveness check, an accepted divergence.
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
  isCompleteResolver?: IsCompleteResolver;
  /** Records on the current walk path; cuts the cycles corrupt data can hold. */
  path: Set<string>;
  /** Child-type fields resolved once per walk; the ui-spec never changes mid-walk. */
  childFieldSpecs: Map<string, ChildFieldSpec>;
}

/**
 * Computes the recursive status report for a record: per node the HRID,
 * required-field completion, summary values and the same for child records
 * (faims-core::Child links only). A hidden Child field still reports its
 * linked children, but its requirement is masked. Deleted, unreadable and
 * corrupt children drop out of both sides of the roll-up; cycles in corrupt
 * data are cut where they close.
 *
 * @param engine - Data engine for the project's data database
 * @param recordId - Root record to report on
 * @param projectId - Links tagged with another project id are skipped
 * @param isCompleteResolver - Optional per-field-type completeness override
 * @returns The report tree rooted at recordId
 * @throws RecordDeletedError if the root record is deleted
 * @throws UnknownFormTypeError if the root's form is not in the ui-spec
 */
export async function computeRecordStatusReport({
  engine,
  recordId,
  projectId,
  isCompleteResolver,
}: {
  engine: DataEngine;
  recordId: string;
} & Omit<
  WalkContext,
  'engine' | 'path' | 'childFieldSpecs'
>): Promise<RecordStatusReport> {
  const ctx: WalkContext = {
    engine,
    projectId,
    isCompleteResolver,
    path: new Set(),
    childFieldSpecs: resolveChildFieldSpecs(engine.uiSpec),
  };
  const report = await walk(ctx, recordId);
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

interface ChildFieldSpec {
  relatedFormId: string;
  required: boolean;
}

/** Resolves the Child-type RelatedRecordSelector fields of the ui-spec, keyed by field id. */
function resolveChildFieldSpecs(
  uiSpec: DataEngine['uiSpec']
): Map<string, ChildFieldSpec> {
  const specs = new Map<string, ChildFieldSpec>();
  for (const [fieldId, fieldSpec] of Object.entries(uiSpec.fields)) {
    const params = getChildRelationParams(fieldSpec);
    if (!params) {
      continue;
    }
    specs.set(fieldId, {
      relatedFormId: params.related_type,
      // required is a base field param, outside the selector params schema
      required: !!fieldSpec['component-parameters']?.required,
    });
  }
  return specs;
}

interface CollectedChildField extends ChildFieldSpec {
  fieldId: string;
  isVisible: boolean;
  /** Distinct linked child ids; cross-project and malformed links excluded. */
  childIds: string[];
}

/** Reads the form's Child-type RelatedRecordSelector fields and their linked child ids. */
function collectChildFields(
  ctx: WalkContext,
  formId: string,
  visibleFields: ReadonlySet<string>,
  data: FormUpdateData | undefined
): CollectedChildField[] {
  const collected: CollectedChildField[] = [];
  // Set: a field listed in two sections is still one child field
  for (const fieldId of new Set(
    fieldIdsForViewset(ctx.engine.uiSpec, formId)
  )) {
    const spec = ctx.childFieldSpecs.get(fieldId);
    if (!spec) {
      continue;
    }
    const raw = data?.[fieldId]?.data;
    const rawEntries = Array.isArray(raw)
      ? raw
      : raw === null || raw === undefined
        ? []
        : [raw];
    // Set: an empty id is not a child; a duplicate link is still one child
    const childIds = new Set<string>();
    for (const rawEntry of rawEntries) {
      const entry = storedLinkEntrySchema.safeParse(rawEntry);
      if (!entry.success) {
        continue;
      }
      const {record_id: childId, project_id: linkProjectId} = entry.data;
      // An empty-string tag means untagged, like an absent one
      if (linkProjectId && linkProjectId !== ctx.projectId) {
        continue;
      }
      if (childId) {
        childIds.add(childId);
      }
    }
    // A hidden field's linked children are still real records; only its
    // requirement is masked, like required-field completion
    const isVisible = visibleFields.has(fieldId);
    collected.push({
      fieldId,
      relatedFormId: spec.relatedFormId,
      required: spec.required && isVisible,
      isVisible,
      childIds: [...childIds],
    });
  }
  return collected;
}

/** Truthy outcomes are live children. */
const isChildReport = (
  outcome: RecordStatusReport | null | undefined
): outcome is RecordStatusReport => !!outcome;

/**
 * One node of the walk: a single hydration fetches the record, head revision
 * and AVPs together; null when the record is a deleted child, or would close
 * a cycle (reports under a cut are best-effort and can vary with link order).
 */
async function walk(
  ctx: WalkContext,
  recordId: string
): Promise<RecordStatusReport | null> {
  if (ctx.path.has(recordId)) {
    return null;
  }
  const {engine} = ctx;

  const node = await engine.form.getExistingFormData({
    recordId,
    config: {conflictBehaviour: 'pickFirst'},
  });
  if (node.context.revision.deleted) {
    return null;
  }
  // hasOwnProperty, since `in` also matches prototype keys ('constructor')
  if (
    !Object.prototype.hasOwnProperty.call(engine.uiSpec.viewsets, node.formId)
  ) {
    throw new UnknownFormTypeError(recordId, node.formId);
  }
  const {formId, data, context} = node;

  const values = formDataToValues(data);
  const visibilityMap = currentlyVisibleMap({
    values,
    uiSpec: engine.uiSpec,
    viewsetId: formId,
  });
  const rawOwnProgress = completion({
    uiSpec: engine.uiSpec,
    data,
    visibilityMap,
    isCompleteResolver: ctx.isCompleteResolver,
  });

  const visibleFields = visibleFieldSet(visibilityMap);

  // Condition-hidden summary fields drop out (stale leftover values); statically
  // hidden ones (e.g. templated fields, recomputed at save) still report.
  const summaryValues: Record<string, unknown> = {};
  const summaryFieldNames = getSummaryFieldInformation(
    engine.uiSpec,
    formId
  ).fieldNames;
  if (summaryFieldNames.length > 0) {
    const summaryVisible = new Set(
      currentlyVisibleFields({
        values,
        uiSpec: engine.uiSpec,
        viewsetId: formId,
        includeStaticallyHidden: true,
      })
    );
    for (const fieldName of summaryFieldNames) {
      if (!summaryVisible.has(fieldName)) continue;
      // null, since JSON serialization would drop an undefined value's key
      summaryValues[fieldName] = data?.[fieldName]?.data ?? null;
    }
  }

  const collected = collectChildFields(ctx, formId, visibleFields, data);
  const distinctChildIds = new Set(collected.flatMap(field => field.childIds));

  // One walk per distinct child, so a child linked from several fields is
  // fetched once and counts as one roll-up unit
  const outcomes = new Map<string, RecordStatusReport | null>();
  ctx.path.add(recordId);
  try {
    for (const childId of distinctChildIds) {
      try {
        outcomes.set(childId, await walk(ctx, childId));
      } catch (err) {
        outcomes.set(childId, absorbSkippableChildError(err));
      }
    }
  } finally {
    ctx.path.delete(recordId);
  }

  const childFields = collected.flatMap((field): RecordStatusChildField[] => {
    const children = field.childIds
      .map(id => outcomes.get(id))
      .filter(isChildReport);
    const createdCount = children.length;
    // A hidden field reports only live children; with none it drops out
    if (!field.isVisible && createdCount === 0) {
      return [];
    }
    return [
      {
        fieldId: field.fieldId,
        relatedFormId: field.relatedFormId,
        required: field.required,
        createdCount,
        expectedCount: createdCount > 0 ? createdCount : field.required ? 1 : 0,
        children,
      },
    ];
  });

  const ownProgress = adjustOwnProgressForChildren(rawOwnProgress, childFields);

  // Each live child is one unit alongside the record's own form; a field
  // expecting children but having none contributes one empty unit
  const liveReports = [...outcomes.values()].filter(isChildReport);
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
  };
}
