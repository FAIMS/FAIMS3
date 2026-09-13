/**
 * Recursive revision history for a record and the records hanging off it.
 *
 * A parent's own revisions say nothing about work done on its children, and a
 * child's read-only page is not always reachable, so reading a parent's whole
 * story meant opening each child by hand. This walks the same Child-type links
 * the status report walks, so the two cannot disagree about what is a child.
 */
import {DataEngine} from './engine';
import {RecordDeletedError} from './exceptions';
import {
  absorbSkippableChildError,
  collectChildRecordLinks,
  resolveChildFieldSpecs,
  type ChildFieldSpec,
} from './statusReport';
import {
  RecursiveRecordHistory,
  RecursiveRecordHistoryChildField,
} from './types';

interface WalkContext {
  engine: DataEngine;
  projectId: string;
  /** Child-type fields resolved once per walk; the ui-spec never changes mid-walk. */
  childFieldSpecs: Map<string, ChildFieldSpec>;
}

/** Truthy outcomes are live children. */
const isChildHistory = (
  outcome: RecursiveRecordHistory | null | undefined
): outcome is RecursiveRecordHistory => !!outcome;

/**
 * One node of the walk: the record's own revisions plus its children's. Null
 * when the record is a deleted child, or would close a cycle, matching the
 * status report's treatment of the same data.
 */
async function walk(
  ctx: WalkContext,
  recordId: string,
  /** Records on the path from the root; cuts the cycles corrupt data can hold. */
  path: ReadonlySet<string>
): Promise<RecursiveRecordHistory | null> {
  if (path.has(recordId)) {
    return null;
  }
  const {engine} = ctx;

  // Default conflict resolution, like the record page's own reads, so a
  // conflicted record reports the head the form shows
  const node = await engine.form.getExistingFormData({recordId});
  if (node.context.revision.deleted) {
    return null;
  }

  const links = collectChildRecordLinks({
    uiSpec: engine.uiSpec,
    childFieldSpecs: ctx.childFieldSpecs,
    projectId: ctx.projectId,
    formId: node.formId,
    data: node.data,
  });

  const childPath = new Set(path).add(recordId);
  const outcomes = new Map<string, RecursiveRecordHistory | null>();
  await Promise.all(
    links
      .flatMap(link => link.childIds)
      .map(async childId => {
        try {
          outcomes.set(childId, await walk(ctx, childId, childPath));
        } catch (err) {
          outcomes.set(childId, absorbSkippableChildError(err));
        }
      })
  );

  const childFields = links.flatMap(
    (link): RecursiveRecordHistoryChildField[] => {
      const children = link.childIds
        .map(id => outcomes.get(id))
        .filter(isChildHistory);
      // A field whose children all dropped out has no history to show
      if (children.length === 0) {
        return [];
      }
      return [
        {
          fieldId: link.fieldId,
          relatedFormId: link.relatedFormId,
          children,
        },
      ];
    }
  );

  return {
    recordId,
    hrid: node.context.hrid,
    formId: node.formId,
    entries: await engine.form.getHistoryData({recordId}),
    childFields,
  };
}

/**
 * Revision history for a record and, recursively, for the records its
 * Child-type fields link to. Deleted, unreadable and corrupt children drop out
 * rather than failing the tree; cycles in corrupt data are cut where they
 * close.
 *
 * @param engine - Data engine for the project's data database
 * @param recordId - Root record to report on
 * @param projectId - Links tagged with another project id are skipped
 * @returns The history tree rooted at recordId
 * @throws RecordDeletedError if the root record is deleted
 */
export async function computeRecursiveRecordHistory({
  engine,
  recordId,
  projectId,
}: {
  engine: DataEngine;
  recordId: string;
  projectId: string;
}): Promise<RecursiveRecordHistory> {
  const history = await walk(
    {
      engine,
      projectId,
      childFieldSpecs: resolveChildFieldSpecs(engine.uiSpec),
    },
    recordId,
    new Set()
  );
  if (history === null) {
    throw new RecordDeletedError(recordId);
  }
  return history;
}
