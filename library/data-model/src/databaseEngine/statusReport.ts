import {
  currentlyVisibleMap,
  getSummaryValues,
  isFieldStaticallyHidden,
  visibleFieldSet,
} from '../uiSpecification/utils';
import {
  ChildFieldSpec,
  ChildRecordLink,
  ChildTreeWalkContext,
  resolveChildFieldSpecs,
  walkChildRecordTree,
} from './childRecordTree';
import {
  completion,
  completionFromIncomplete,
  CompletionResult,
  formDataToValues,
  IsCompleteResolver,
} from './completion';
import {DataEngine} from './engine';
import {RecordDeletedError} from './exceptions';
import {InitialFormData} from './types';

/** Status of one Child-type related-record field on a record. */
export interface RecordStatusChildField {
  fieldId: string;
  /** Form the children are created from (`related_type`). */
  relatedFormId: string;
  /** Masked to false while the field is hidden, like required-field completion. */
  required: boolean;
  /** Resolvable, non-deleted children. */
  children: RecordStatusReport[];
}

/** Recursive completion roll-up for a record and its child records. */
export interface RecordStatusReport {
  recordId: string;
  hrid: string;
  formId: string;
  /**
   * Roll-up fraction 0->1: (own progress + sum of live child progress) /
   * (1 + live children).
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
    if (field.children.length > 0) {
      incomplete.delete(field.fieldId);
    } else {
      incomplete.add(field.fieldId);
    }
  }
  return completionFromIncomplete(own.requiredCount, [...incomplete]);
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
 * @param isCompleteResolver - Per-field-type completeness override; pass
 *   `() => undefined` to score every field with the default rule
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
  projectId: string;
  isCompleteResolver: IsCompleteResolver;
}): Promise<RecordStatusReport> {
  const ctx: ChildTreeWalkContext = {
    engine,
    projectId,
    childFieldSpecs: resolveChildFieldSpecs(engine.uiSpec),
  };
  const report = await walkChildRecordTree<RecordStatusReport, OwnStatus>({
    ctx,
    recordId,
    path: new Set(),
    startOwnWork: ({node}) =>
      scoreOwnRecord({engine, isCompleteResolver, node}),
    buildNode: args =>
      buildStatusNode({childFieldSpecs: ctx.childFieldSpecs, ...args}),
  });
  if (report === null) {
    throw new RecordDeletedError(recordId);
  }
  return report;
}

/** A record's own scoring, computed while its children are walked. */
interface OwnStatus {
  rawOwnProgress: CompletionResult;
  summaryValues: Record<string, unknown>;
  visibleFields: ReadonlySet<string>;
}

/** Scores one record's own fields, before its children are known. */
function scoreOwnRecord({
  engine,
  isCompleteResolver,
  node,
}: {
  engine: DataEngine;
  isCompleteResolver: IsCompleteResolver;
  node: InitialFormData;
}): OwnStatus {
  const {formId, data} = node;
  const values = formDataToValues(data);
  // One condition pass serves both consumers: completion excludes statically
  // hidden fields, summary values include them (templated, recomputed at save)
  const fullVisibilityMap = currentlyVisibleMap({
    values,
    uiSpec: engine.uiSpec,
    viewsetId: formId,
    includeStaticallyHidden: true,
  });
  const visibilityMap = Object.fromEntries(
    Object.entries(fullVisibilityMap).map(([viewId, fieldIds]) => [
      viewId,
      fieldIds.filter(
        fieldId => !isFieldStaticallyHidden(engine.uiSpec.fields[fieldId])
      ),
    ])
  );
  return {
    rawOwnProgress: completion({
      uiSpec: engine.uiSpec,
      formId,
      data,
      visibilityMap,
      isCompleteResolver,
    }),
    summaryValues: getSummaryValues({
      uiSpec: engine.uiSpec,
      formId,
      values,
      visibleFields: visibleFieldSet(fullVisibilityMap),
    }),
    visibleFields: visibleFieldSet(visibilityMap),
  };
}

interface CollectedChildField extends ChildRecordLink {
  required: boolean;
  isVisible: boolean;
}

/** Applies the parent's field visibility to its Child-type links. */
function collectChildFields(
  childFieldSpecs: Map<string, ChildFieldSpec>,
  links: ChildRecordLink[],
  visibleFields: ReadonlySet<string>
): CollectedChildField[] {
  return links.map(link => {
    // A hidden field's linked children are still real records; only its
    // requirement is masked, like required-field completion
    const isVisible = visibleFields.has(link.fieldId);
    return {
      ...link,
      required: !!childFieldSpecs.get(link.fieldId)?.required && isVisible,
      isVisible,
    };
  });
}

/** Truthy outcomes are live children. */
const isChildReport = (
  outcome: RecordStatusReport | null | undefined
): outcome is RecordStatusReport => !!outcome;

/** Rolls one record's own scoring up with the reports of its children. */
function buildStatusNode({
  childFieldSpecs,
  recordId,
  node,
  own,
  links,
  outcomes,
}: {
  childFieldSpecs: Map<string, ChildFieldSpec>;
  recordId: string;
  node: InitialFormData;
  own: OwnStatus;
  links: ChildRecordLink[];
  outcomes: ReadonlyMap<string, RecordStatusReport | null>;
}): RecordStatusReport {
  const collected = collectChildFields(
    childFieldSpecs,
    links,
    own.visibleFields
  );
  const childFields = collected.flatMap((field): RecordStatusChildField[] => {
    const children = field.childIds
      .map(id => outcomes.get(id))
      .filter(isChildReport);
    // A hidden field reports only live children; with none it drops out
    if (!field.isVisible && children.length === 0) {
      return [];
    }
    return [
      {
        fieldId: field.fieldId,
        relatedFormId: field.relatedFormId,
        required: field.required,
        children,
      },
    ];
  });

  const ownProgress = adjustOwnProgressForChildren(
    own.rawOwnProgress,
    childFields
  );

  // Each live child is one unit alongside the record's own form; an empty
  // required child field is charged once, through ownProgress
  const liveReports = [...outcomes.values()].filter(isChildReport);
  const childProgressSum = liveReports.reduce(
    (sum, child) => sum + child.progress,
    0
  );

  return {
    recordId,
    hrid: node.context.hrid,
    formId: node.formId,
    progress:
      (ownProgress.progress + childProgressSum) / (1 + liveReports.length),
    ownProgress,
    summaryValues: own.summaryValues,
    childFields,
  };
}
