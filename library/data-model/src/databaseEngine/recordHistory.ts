// SPDX-License-Identifier: Apache-2.0
/**
 * Recursive revision history for a record and the records hanging off it.
 *
 * A parent's own revisions say nothing about work done on its children, and a
 * child's read-only page is not always reachable, so reading a parent's whole
 * story meant opening each child by hand. This is the same walk the status
 * report makes, so the two cannot disagree about what is a child; history
 * keeps deleted records so their delete revisions appear.
 */
import {
  ChildTreeWalkContext,
  resolveChildFieldSpecs,
  walkChildRecordTree,
} from './childRecordTree';
import {DataEngine} from './engine';
import {
  RecursiveRecordHistory,
  RecursiveRecordHistoryChildField,
  RevisionHistoryEntry,
} from './types';

/** Truthy outcomes are included children (live or deleted). */
const isChildHistory = (
  outcome: RecursiveRecordHistory | null | undefined
): outcome is RecursiveRecordHistory => !!outcome;

/**
 * Revision history for a record and, recursively, for the records its
 * Child-type fields link to. Deleted records stay in the tree so their delete
 * revisions appear; unreadable and corrupt children drop out rather than
 * failing the tree; cycles in corrupt data are cut where they close.
 *
 * @param engine - Data engine for the project's data database
 * @param recordId - Root record to report on
 * @param projectId - Links tagged with another project id are skipped
 * @returns The history tree rooted at recordId
 * @throws UnknownFormTypeError if the root's form is not in the ui-spec
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
  const ctx: ChildTreeWalkContext = {
    engine,
    projectId,
    childFieldSpecs: resolveChildFieldSpecs(engine.uiSpec),
    includeDeleted: 'all',
  };
  const history = await walkChildRecordTree<
    RecursiveRecordHistory,
    RevisionHistoryEntry[]
  >({
    ctx,
    recordId,
    path: new Set(),
    startOwnWork: ({recordId}) => engine.form.getHistoryData({recordId}),
    buildNode: ({recordId, node, own: entries, links, outcomes}) => ({
      recordId,
      hrid: node.context.hrid,
      formId: node.formId,
      entries,
      childFields: links.flatMap((link): RecursiveRecordHistoryChildField[] => {
        const children = link.childIds
          .map(id => outcomes.get(id))
          .filter(isChildHistory);
        // A field whose children all dropped out has no history to show
        return children.length === 0 ? [] : [{fieldId: link.fieldId, children}];
      }),
    }),
  });
  if (history === null) {
    // includeDeleted is 'all', so a deleted root is a node; null is only a
    // cycle, which the empty root path cannot close.
    throw new Error(`Record history walk for "${recordId}" produced no node.`);
  }
  return history;
}
