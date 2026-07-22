// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @file Helper functions for the condition editor.
 *
 */

import {isFieldUsedInCondition} from '@/designer/domain/conditions/conditionReferences';
import {FieldType} from '@/designer/state/initial';
import {
  ConditionBooleanOperator,
  ConditionEditorNode,
  ConditionGroupNode,
  ConditionRuleNode,
  ConditionType,
  GroupCondition,
  RuleCondition,
  SelectableConditionOption,
} from '@/designer/types/condition';
import {ChoiceElementProps, TemplatedStringProps} from '@faims3/forms';

/**
 * Helpers for the condition editor.
 *
 * Important:
 * - `ConditionType` is the persisted/saved shape used by the existing app.
 * - `ConditionEditorNode` / `ConditionGroupNode` / `ConditionRuleNode` are only
 *   used by the editor UI so drag/drop and grouping have stable node IDs.
 * - Editor IDs are never saved back into `ConditionType`.
 */

/**
 * Root group ID is fixed because each editor has exactly one root.
 * Normal rules/groups must use generated IDs because the same field can appear
 * in multiple condition rows.
 */
export const ROOT_CONDITION_GROUP_ID = 'root';

/**
 * Creates a unique editor-only ID.
 *
 * Do not use field IDs as condition row IDs. A condition can contain the same
 * field more than once.
 *
 * @param prefix - The node type prefix for the ID.
 * @returns A unique editor ID.
 */
const createEditorId = (prefix: 'rule' | 'group') => {
  if (crypto?.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

/**
 * Finds the first condition rule in display order.
 *
 * @param group - Group to search, including its nested groups.
 * @returns The first rule editor ID, or null if no rule exists.
 */
export const getFirstRuleEditorId = (
  group: ConditionGroupNode
): string | null => {
  for (const child of group.children) {
    if (child.type === 'rule') {
      return child.editorId;
    }

    const nestedRuleId = getFirstRuleEditorId(child);

    if (nestedRuleId) {
      return nestedRuleId;
    }
  }

  return null;
};

/**
 * Creates a blank condition rule row.
 *
 * @returns A new empty rule node with a unique editor ID.
 */
export const createEmptyRule = (): ConditionRuleNode => ({
  editorId: createEditorId('rule'),
  type: 'rule',
  field: '',
  // default to 'equal'
  operator: 'equal',
  value: '',
});

/**
 * Creates an empty root group for the editor.
 *
 * @returns A root group containing one blank rule row.
 */
export const createEmptyRootGroup = (): ConditionGroupNode => ({
  editorId: ROOT_CONDITION_GROUP_ID,
  type: 'group',
  operator: 'and',
  children: [createEmptyRule()],
});

/**
 * Normalises one editor node.
 *
 * Empty groups are removed. One-child groups are preserved because they can
 * represent a group that the user is still building in the editor.
 *
 * One-child groups are still flattened when converting to the saved condition
 * shape.
 *
 * @param node - The node to normalise.
 * @returns The normalised node, or `null` if the node should be removed.
 */
const normalizeNode = (
  node: ConditionEditorNode
): ConditionEditorNode | null => {
  if (node.type === 'rule') return node;

  const children = node.children
    .map(normalizeNode)
    .filter((child): child is ConditionEditorNode => child !== null);

  if (children.length === 0) return null;

  return {
    ...node,
    children,
  };
};

/**
 * Ensures the root group always has at least one child row.
 *
 * @param root - The root group to check.
 * @returns The root group, with a blank rule added if it had no children.
 */
export const ensureRootHasChild = (
  root: ConditionGroupNode
): ConditionGroupNode => ({
  ...root,
  children: root.children.length > 0 ? root.children : [createEmptyRule()],
});

/**
 * Normalises the editor tree.
 *
 * Empty groups are removed and the root group is kept valid. One-child groups
 * are preserved as editor state but flattened when converted for saving.
 *
 * @param root - The root group to normalise.
 * @returns The normalised root group.
 */
const normalizeEditorTree = (root: ConditionGroupNode): ConditionGroupNode => {
  const children = root.children
    .map(normalizeNode)
    .filter((node): node is ConditionEditorNode => node !== null);

  return ensureRootHasChild({
    ...root,
    children,
  });
};

/**
 * Checks whether a string is an AND/OR operator.
 *
 * @param operator - The operator to check.
 * @returns `true` if the operator is `and` or `or`.
 */
const isBooleanOperator = (
  operator: string | undefined
): operator is ConditionBooleanOperator =>
  operator === 'and' || operator === 'or';

/**
 * Checks whether a saved condition is a boolean group condition.
 *
 * @param condition - The saved condition to check.
 * @returns `true` if the condition uses an AND/OR operator.
 */
export const isBooleanCondition = (
  condition: ConditionType
): condition is GroupCondition => isBooleanOperator(condition.operator);

/**
 * Converts one saved condition into an editor node.
 *
 * @param condition - The saved condition to convert.
 * @returns A rule or group node with a fresh editor ID.
 */
const conditionToNode = (condition: ConditionType): ConditionEditorNode => {
  if (isBooleanCondition(condition)) {
    return {
      editorId: createEditorId('group'),
      type: 'group',
      operator: condition.operator,
      children: (condition.conditions ?? []).map(conditionToNode),
    };
  }

  return {
    editorId: createEditorId('rule'),
    type: 'rule',
    field: condition.field ?? '',
    operator: condition.operator ?? 'equal',
    value: condition.value ?? '',
  };
};

/**
 * Converts a saved condition into the editor tree shape.
 *
 * Saved conditions do not contain editor IDs, so this creates fresh editor-only
 * IDs for rules and groups.
 *
 * @param condition - The saved condition to convert.
 * @returns A root group for the editor.
 */
export const conditionToEditorTree = (
  condition: ConditionType | null
): ConditionGroupNode => {
  if (!condition) return createEmptyRootGroup();

  const node = conditionToNode(condition);

  if (node.type === 'group') {
    const rawRoot = {
      ...node,
      editorId: ROOT_CONDITION_GROUP_ID,
      children: node.children.length > 0 ? node.children : [createEmptyRule()],
    };
    return normalizeEditorTree(rawRoot);
  }

  const rawRoot: ConditionGroupNode = {
    editorId: ROOT_CONDITION_GROUP_ID,
    type: 'group',
    operator: 'and',
    children: [node],
  };
  return normalizeEditorTree(rawRoot);
};

/**
 * Converts one editor node into a saved condition.
 *
 * @param node - The editor node to convert.
 * @returns The saved condition, or `null` if the node should not be saved.
 */
const nodeToCondition = (node: ConditionEditorNode): ConditionType | null => {
  if (node.type === 'rule') {
    // Keep incomplete rows in the editor UI, but do not save them.
    // Empty string is a valid value, so only reject undefined.
    if (!node.field || !node.operator || node.value === undefined) return null;

    return {
      field: node.field,
      operator: node.operator,
      value: node.value,
    } as RuleCondition;
  }

  const children = node.children
    .map(nodeToCondition)
    .filter((condition): condition is ConditionType => condition !== null);

  if (children.length === 0) return null;

  // One-child groups have no logical meaning, so flatten them on save.
  if (children.length === 1) return children[0];

  return {
    operator: node.operator,
    conditions: children,
  } as GroupCondition;
};

/**
 * Converts the editor tree back to the saved condition shape.
 *
 * Editor-only IDs are omitted. Incomplete rows are not saved, and one-child
 * groups are flattened.
 *
 * @param root - The editor root group to convert.
 * @returns The saved condition, or `null` if there are no valid rules.
 */
export const editorTreeToCondition = (
  root: ConditionGroupNode
): ConditionType | null => {
  const children = root.children
    .map(nodeToCondition)
    .filter((condition): condition is ConditionType => condition !== null);

  if (children.length === 0) return null;

  // A root with one valid child does not need to be saved as an AND/OR group.
  if (children.length === 1) return children[0];

  return {
    operator: root.operator,
    conditions: children,
  } as ConditionType;
};

/**
 * Normalises a saved condition before comparison.
 *
 * This gives equivalent conditions a consistent saved shape and object key
 * order, so `JSON.stringify` does not report false changes.
 */
export const normaliseConditionForCompare = (
  condition: ConditionType | null | undefined
): ConditionType | null => {
  return editorTreeToCondition(conditionToEditorTree(condition ?? null));
};

/**
 * Finds a group node by editor ID.
 *
 * @param root - The root group to search from.
 * @param groupId - The editor ID of the group to find.
 * @returns The matching group, or `null` if no group exists with that ID.
 */
const findGroup = (
  root: ConditionGroupNode,
  groupId: string
): ConditionGroupNode | null => {
  if (root.editorId === groupId) return root;

  for (const child of root.children) {
    if (child?.type === 'group') {
      const found = findGroup(child, groupId);
      if (found) return found;
    }
  }

  return null;
};

/**
 * Returns the number of children in a group.
 *
 * @param root - The root group to search from.
 * @param groupId - The editor ID of the group.
 * @returns The child count, or `0` if the group cannot be found.
 */
export const getGroupChildCount = (
  root: ConditionGroupNode,
  groupId: string
): number => {
  const group = findGroup(root, groupId);
  return group?.children.length ?? 0;
};

///
/// ConditionEditorActions implements
///

/**
 * Recursively maps a rule or group node.
 *
 * @param node - The node to map.
 * @param mapper - Function used to transform each node.
 * @returns The mapped node.
 */
const mapNode = (
  node: ConditionEditorNode,
  mapper: (node: ConditionEditorNode) => ConditionEditorNode
): ConditionEditorNode => {
  if (node.type === 'rule') return mapper(node);

  const mappedGroup: ConditionGroupNode = {
    ...node,
    children: node.children.map(child => mapNode(child, mapper)),
  };

  return mapper(mappedGroup);
};

/**
 * Maps the whole editor tree, including the root group.
 *
 * The root is checked after mapping because the editor root must always remain
 * the fixed root group.
 *
 * @param root - The root group to map.
 * @param mapper - Function used to transform each node.
 * @returns The mapped root group, or the original root if mapping produced an invalid root.
 */
const mapRoot = (
  root: ConditionGroupNode,
  mapper: (node: ConditionEditorNode) => ConditionEditorNode
): ConditionGroupNode => {
  const mappedRoot = mapNode(root, mapper);

  // Defensive guard: the editor root must always stay a group.
  if (
    mappedRoot.editorId !== ROOT_CONDITION_GROUP_ID ||
    mappedRoot.type !== 'group'
  ) {
    console.error(
      '[ConditionEditor] Invalid root after mapRoot. Expected root to remain a group with editorId "root". Update ignored.',
      {previousRoot: root, mappedRoot}
    );
    return root;
  }

  return mappedRoot;
};

/**
 * Updates a rule node by editor ID.
 *
 * @param root - The current editor root.
 * @param nodeId - The editor ID of the rule to update.
 * @param patch - Partial rule fields to merge into the rule.
 * @returns The updated and normalised editor root.
 */
export const updateRuleNode = (
  root: ConditionGroupNode,
  nodeId: string,
  patch: Partial<RuleCondition>
): ConditionGroupNode => {
  const nextRoot = mapRoot(root, node =>
    node.type === 'rule' && node.editorId === nodeId
      ? {...node, ...patch}
      : node
  );
  return normalizeEditorTree(nextRoot);
};

/**
 * Adds a blank rule to the end of a group.
 *
 * @param root - The current editor root.
 * @param groupId - The editor ID of the group to append to.
 * @returns The updated and normalised editor root.
 */
export const addRuleToGroup = (
  root: ConditionGroupNode,
  groupId: string
): ConditionGroupNode => {
  const nextRoot = mapRoot(root, node => {
    if (node.type !== 'group' || node.editorId !== groupId) return node;

    const newRule = createEmptyRule();
    return {...node, children: [...node.children, newRule]};
  });

  return normalizeEditorTree(nextRoot);
};

/**
 * Updates a group's boolean operator.
 *
 * @param root - The current editor root.
 * @param groupId - The editor ID of the group to update.
 * @param operator - The new boolean operator.
 * @returns The updated and normalised editor root.
 */
export const updateGroupOperator = (
  root: ConditionGroupNode,
  groupId: string,
  operator: ConditionBooleanOperator
): ConditionGroupNode => {
  const nextRoot = mapRoot(root, node =>
    node.type === 'group' && node.editorId === groupId
      ? {...node, operator}
      : node
  );

  return normalizeEditorTree(nextRoot);
};

/**
 * Removes a node from the tree and returns the removed node.
 *
 * This is mainly used by drag/drop move logic: remove the node from its old
 * location first, then insert the same node into the target group.
 *
 * @param root - The current editor root.
 * @param nodeId - The editor ID of the node to remove.
 * @returns The updated root and the removed node, if found.
 */
const removeNode = (
  root: ConditionGroupNode,
  nodeId: string
): {root: ConditionGroupNode; node: ConditionEditorNode | null} => {
  let removedNode: ConditionEditorNode | null = null;

  const removeFromGroup = (group: ConditionGroupNode): ConditionGroupNode => {
    const children = group.children.reduce<ConditionEditorNode[]>(
      (result, child) => {
        if (child.editorId === nodeId) {
          removedNode = child;
          return result;
        }

        if (child.type === 'group') {
          const nextGroup = removeFromGroup(child);

          if (nextGroup.children.length > 0) {
            result.push(nextGroup);
          }

          return result;
        }

        result.push(child);
        return result;
      },
      []
    );

    return {...group, children};
  };

  return {root: removeFromGroup(root), node: removedNode};
};

/**
 * Deletes a rule or group from the editor tree.
 *
 * If the root group is deleted, the editor is reset to a new empty root group.
 *
 * @param root - The current editor root.
 * @param nodeId - The editor ID of the rule or group to delete.
 * @returns The updated and normalised editor root.
 */
export const deleteNodeFromTree = (
  root: ConditionGroupNode,
  nodeId: string
): ConditionGroupNode => {
  // clear root
  if (nodeId === root.editorId) return createEmptyRootGroup();

  const {root: nextRoot} = removeNode(root, nodeId);
  return normalizeEditorTree(nextRoot);
};

type NodeLocation = {
  parentGroupId: string;
  index: number;
  node: ConditionEditorNode;
};

/**
 * Finds a node and records its parent group and index.
 *
 * @param group - The group to search from.
 * @param id - The editor ID of the node to find.
 * @returns The node location, or `null` if the node cannot be found.
 */
const findNodeLocation = (
  group: ConditionGroupNode,
  id: string
): NodeLocation | null => {
  for (let index = 0; index < group.children.length; index += 1) {
    const child = group.children[index];

    if (child.editorId === id) {
      return {
        parentGroupId: group.editorId,
        index,
        node: child,
      };
    }

    if (child.type === 'group') {
      const found = findNodeLocation(child, id);
      if (found) return found;
    }
  }

  return null;
};

/**
 * Checks whether a group contains another group.
 *
 * Used to prevent moving a group into itself or one of its descendants.
 *
 * @param group - The group to search inside.
 * @param groupId - The editor ID of the group to find.
 * @returns `true` if the group is found inside the supplied group.
 */
const containsGroup = (group: ConditionGroupNode, groupId: string): boolean => {
  if (group.editorId === groupId) return true;

  return group.children.some(
    child => child.type === 'group' && containsGroup(child, groupId)
  );
};

/**
 * Checks whether a group contains a node with the supplied editor ID.
 *
 * sed to prevent moving a group onto one of its own descendant rules.
 *
 * @param group - The group to search inside.
 * @param nodeId - The editor ID of the node to find.
 * @returns `true` if the node is found inside the supplied group.
 */
const containsNode = (group: ConditionGroupNode, nodeId: string): boolean =>
  group.children.some(
    child =>
      child.editorId === nodeId ||
      (child.type === 'group' && containsNode(child, nodeId))
  );

/**
 * Inserts a node into a target group at a specific index.
 *
 * The index is clamped so it always stays within the target group's child list.
 *
 * @param root - The current editor root.
 * @param targetGroupId - The editor ID of the group to insert into.
 * @param targetIndex - The requested insert index.
 * @param nodeToInsert - The node to insert.
 * @returns The updated editor root.
 */
const insertNode = (
  root: ConditionGroupNode,
  targetGroupId: string,
  targetIndex: number,
  nodeToInsert: ConditionEditorNode
): ConditionGroupNode =>
  mapRoot(root, node => {
    if (node.type !== 'group' || node.editorId !== targetGroupId) return node;

    const index = Math.max(0, Math.min(targetIndex, node.children.length));

    return {
      ...node,
      children: [
        ...node.children.slice(0, index),
        nodeToInsert,
        ...node.children.slice(index),
      ],
    };
  });

/**
 * Checks whether a drop slot is a no-op for the dragged item.
 *
 * For an item inside the same group, dropping before itself or immediately
 * after itself would keep the order unchanged.
 *
 * @param targetIndex - The drop slot index.
 * @param sourceIndex - The dragged item's current index in this group.
 * @returns `true` when the drop would not change the order.
 */
export const isNoOpDropIndex = (targetIndex: number, sourceIndex: number) =>
  sourceIndex >= 0 &&
  (targetIndex === sourceIndex || targetIndex === sourceIndex + 1);

/**
 * Moves a rule or group into another group.
 *
 * Used by drag/drop. The root group cannot be moved, and a group cannot be
 * moved into itself or one of its descendants.
 *
 * @param root - The current editor root.
 * @param nodeId - The editor ID of the node to move.
 * @param targetGroupId - The editor ID of the group to move into.
 * @param targetIndex - The index to insert the node at in the target group.
 * @returns The updated and normalised editor root.
 */
export const moveNodeInTree = (
  root: ConditionGroupNode,
  nodeId: string,
  targetGroupId: string,
  targetIndex: number
): ConditionGroupNode => {
  if (nodeId === root.editorId) return root;

  const sourceLocation = findNodeLocation(root, nodeId);
  if (!sourceLocation) return root;

  // Prevent moving a group inside itself or one of its own child groups.
  if (
    sourceLocation.node.type === 'group' &&
    containsGroup(sourceLocation.node, targetGroupId)
  )
    return root;

  let adjustedTargetIndex = targetIndex;

  // When moving inside the same group, removing the source row (first step) changes the index.
  // Example: [A, B], move A to the slot after A.
  // Raw targetIndex is 1, but after removing A the correct index is 0.
  // Example: [A, B, C], move A to the slot after C.
  // Raw targetIndex is 3, but after removing A the correct insert index is 2.
  if (sourceLocation.parentGroupId === targetGroupId) {
    const sourceIndex = sourceLocation.index;

    // Dropping immediately before or after itself should do nothing.
    if (isNoOpDropIndex(targetIndex, sourceIndex)) {
      return root;
    }
    if (targetIndex > sourceIndex) {
      adjustedTargetIndex = targetIndex - 1;
    }
  }

  // remove node first
  const removed = removeNode(root, nodeId);
  if (!removed.node) return root;

  // Check target after removal. If target no longer exists, do not lose the node.
  if (!findGroup(removed.root, targetGroupId)) {
    return root;
  }

  // insert into the target group
  const inserted = insertNode(
    removed.root,
    targetGroupId,
    adjustedTargetIndex,
    removed.node
  );
  return normalizeEditorTree(inserted);
};

/**
 * Moves a rule or group into a new group with an existing rule.
 *
 * The target rule remains first and the dragged node is added after it.
 *
 * @param root - The current editor root.
 * @param nodeId - The editor ID of the rule or group to move.
 * @param targetRuleId - The editor ID of the rule to group with.
 * @param operator - The boolean operator for the new group.
 * @returns The updated and normalised editor root.
 */
export const groupNodeWithRuleInTree = (
  root: ConditionGroupNode,
  nodeId: string,
  targetRuleId: string,
  operator: ConditionBooleanOperator = 'and'
): ConditionGroupNode => {
  if (nodeId === root.editorId || nodeId === targetRuleId) return root;

  const sourceLocation = findNodeLocation(root, nodeId);
  if (!sourceLocation) return root;

  const targetLocation = findNodeLocation(root, targetRuleId);
  if (!targetLocation || targetLocation.node.type !== 'rule') {
    return root;
  }

  // Prevent moving a group onto one of its own descendant rules.
  if (
    sourceLocation.node.type === 'group' &&
    containsNode(sourceLocation.node, targetRuleId)
  )
    return root;

  // remove node first
  const removed = removeNode(root, nodeId);
  const sourceNode = removed.node;

  if (!sourceNode) return root;

  // The target could have disappeared if it was inside the dragged group.
  const remainingTarget = findNodeLocation(removed.root, targetRuleId);

  if (!remainingTarget || remainingTarget.node.type !== 'rule') {
    return root;
  }

  const nextRoot = mapRoot(removed.root, node => {
    if (node.type !== 'rule' || node.editorId !== targetRuleId) {
      return node;
    }

    return {
      editorId: createEditorId('group'),
      type: 'group',
      operator,
      children: [node, sourceNode],
    };
  });

  return normalizeEditorTree(nextRoot);
};

/**
 * Wraps a rule row in a new group.
 *
 * The new group initially contains only the selected rule. The UI displays an
 * add/drop prompt until another condition is added.
 *
 * @param root - The current editor root.
 * @param nodeId - The editor ID of the rule to wrap.
 * @param operator - The boolean operator for the new group.
 * @returns The updated and normalised editor root.
 */
export const wrapRuleInGroup = (
  root: ConditionGroupNode,
  nodeId: string,
  operator: ConditionBooleanOperator = 'and'
): ConditionGroupNode => {
  const nextRoot = mapRoot(root, node => {
    if (node.type !== 'rule' || node.editorId !== nodeId) return node;

    return {
      editorId: createEditorId('group'),
      type: 'group',
      operator,
      children: [node],
    };
  });

  return normalizeEditorTree(nextRoot);
};

/**
 * Replaces a nested group with its children.
 *
 * @param group - The group to search from.
 * @param groupId - The editor ID of the group to ungroup.
 * @returns A new group tree with the target group replaced by its children.
 */
const ungroupFromGroup = (
  group: ConditionGroupNode,
  groupId: string
): ConditionGroupNode => {
  const children = group.children.reduce<ConditionEditorNode[]>(
    (result, child) => {
      if (child.type === 'group' && child.editorId === groupId) {
        result.push(...child.children);
        return result;
      }

      if (child.type === 'group') {
        result.push(ungroupFromGroup(child, groupId));
        return result;
      }

      result.push(child);
      return result;
    },
    []
  );

  return {...group, children};
};

/**
 * Replaces a group with its children.
 *
 * The root group cannot be ungrouped.
 *
 * @param root - The current editor root.
 * @param groupId - The editor ID of the group to ungroup.
 * @returns The updated and normalised editor root.
 */
export const ungroupNode = (
  root: ConditionGroupNode,
  groupId: string
): ConditionGroupNode => {
  if (groupId === root.editorId) return root;

  const nextRoot = ungroupFromGroup(root, groupId);
  return normalizeEditorTree(nextRoot);
};

///
/// drag and drop
///

/**
 * Indexed drop target id.
 *
 * Format:
 * group:<groupId>:index:<index>
 *
 * Example:
 * group:root:index:2
 *
 * Means: insert into root group at child index 2.
 */
export const makeIndexedDropId = (groupId: string, index: number) =>
  `group:${groupId}:index:${index}`;

/**
 * Drop target id.
 * Used to create a new group around a rule.
 *
 * Format:
 * rule:<ruleId>:group
 */
export const makeRuleGroupDropId = (ruleId: string) => `rule:${ruleId}:group`;

/**
 * Checks whether the active drop target belongs to a group.
 *
 * Each group owns indexed drop slots with IDs like:
 * `group:<groupId>:index:<index>`.
 *
 * This is used to highlight the group border when one of its own drop slots is
 * active during drag/drop.
 *
 * @param activeDropTargetId - The currently active drop target ID.
 * @param groupId - The editor ID of the group being checked.
 * @returns `true` if the active drop target is one of this group's drop slots.
 */
export const isActiveGroupDropTarget = (
  activeDropTargetId: string | null,
  groupId: string
): boolean =>
  activeDropTargetId?.startsWith(`group:${groupId}:index:`) ?? false;

/**
 * Parses a dnd-kit target id back into a group id and insert index.
 */
export type ParsedDropTarget =
  | {
      type: 'group';
      groupId: string;
      index?: number;
    }
  | {
      type: 'rule';
      ruleId: string;
    };

/**
 * Parses a drag/drop target ID.
 *
 * Group targets insert into an existing group. Rule targets create a new group
 * containing the target rule and the dragged node.
 */
export const parseDropTarget = (id: string): ParsedDropTarget | null => {
  const parts = id.split(':');

  // Rule target
  if (parts[0] === 'rule') {
    const ruleId = parts[1];

    if (!ruleId || parts[2] !== 'group') return null;

    return {
      type: 'rule',
      ruleId,
    };
  }

  // Group targets
  if (parts[0] !== 'group') return null;

  const groupId = parts[1];
  if (!groupId) return null;

  if (parts[2] === 'index' && parts[3] !== undefined) {
    const index = Number(parts[3]);
    return Number.isFinite(index)
      ? {
          type: 'group',
          groupId,
          index,
        }
      : null;
  }

  return {
    type: 'group',
    groupId,
  };
};

///
/// Condition summary helpers
///

/**
 * Display label for a field (`InputLabelProps.label` overrides `component-parameters.label`).
 *
 * @param f - Field definition from the UI spec.
 * @returns Human-readable label string.
 */
export const getFieldLabel = (f: FieldType) => {
  const params = f['component-parameters'] as TemplatedStringProps;
  return (
    (params.InputLabelProps && params.InputLabelProps.label) || params.label
  );
};

///
/// Other common condition helpers
///

type FieldMap = Record<string, FieldType>;
type ViewMap = Record<
  string,
  {label: string; condition?: ConditionType; fields: string[]}
>;
type ViewSetMap = Record<string, {label: string; views: string[]}>;

export type FieldDependencyReference = {
  type: 'section-condition' | 'field-condition' | 'templated-string';
  formId?: string;
  formLabel?: string;
  sectionId?: string;
  sectionLabel?: string;
  fieldId?: string;
  fieldLabel?: string;
  templateUsage?: string;
};

const buildFieldLocationMaps = (allViews: ViewMap, viewsets: ViewSetMap) => {
  const sectionToForm = new Map<string, {formId: string; formLabel: string}>();
  const fieldToSection = new Map<
    string,
    {sectionId: string; sectionLabel: string}
  >();

  for (const [formId, viewset] of Object.entries(viewsets)) {
    for (const sectionId of viewset.views) {
      sectionToForm.set(sectionId, {formId, formLabel: viewset.label});
    }
  }

  for (const [sectionId, sectionDef] of Object.entries(allViews)) {
    for (const fieldId of sectionDef.fields) {
      fieldToSection.set(fieldId, {
        sectionId,
        sectionLabel: sectionDef.label,
      });
    }
  }

  return {sectionToForm, fieldToSection};
};

/**
 * Lists sections/fields/templated strings that reference `fieldName` (conditions or `{{fieldName}}`).
 * Scoped to the same form as `fieldName` — conditions cannot reference fields from other forms.
 */
export const findFieldDependencyReferences = (
  fieldName: string,
  allFields: FieldMap,
  allViews: ViewMap,
  viewsets: ViewSetMap
): FieldDependencyReference[] => {
  const affected: FieldDependencyReference[] = [];
  const {sectionToForm, fieldToSection} = buildFieldLocationMaps(
    allViews,
    viewsets
  );

  // Conditions can only reference fields within the same form, so scope scanning
  // to the viewset that contains fieldName.
  const fieldSection = fieldToSection.get(fieldName);
  const fieldFormId = fieldSection
    ? sectionToForm.get(fieldSection.sectionId)?.formId
    : undefined;
  const scopedViewset = fieldFormId ? viewsets[fieldFormId] : null;
  const scopedSectionIds = scopedViewset ? new Set(scopedViewset.views) : null;

  const scopedViews = scopedSectionIds
    ? Object.fromEntries(
        Object.entries(allViews).filter(([id]) => scopedSectionIds.has(id))
      )
    : allViews;

  const scopedFieldIds = new Set(
    Object.values(scopedViews).flatMap(s => s.fields)
  );
  const scopedFields = Object.fromEntries(
    Object.entries(allFields).filter(([id]) => scopedFieldIds.has(id))
  );

  // Check section-level conditions
  for (const [sectionId, sectionDef] of Object.entries(scopedViews)) {
    const condition = sectionDef.condition;
    if (isFieldUsedInCondition(condition, fieldName)) {
      const form = sectionToForm.get(sectionId);
      affected.push({
        type: 'section-condition',
        formId: form?.formId,
        formLabel: form?.formLabel,
        sectionId,
        sectionLabel: sectionDef.label,
      });
    }
  }

  // Check field-level conditions
  for (const [fId, fieldDef] of Object.entries(scopedFields)) {
    const condition = fieldDef.condition;
    if (isFieldUsedInCondition(condition, fieldName)) {
      const label = fieldDef['component-parameters']?.label ?? fId;
      const section = fieldToSection.get(fId);
      const form = section?.sectionId
        ? sectionToForm.get(section.sectionId)
        : undefined;
      affected.push({
        type: 'field-condition',
        formId: form?.formId,
        formLabel: form?.formLabel,
        sectionId: section?.sectionId,
        sectionLabel: section?.sectionLabel,
        fieldId: fId,
        fieldLabel: label,
      });
    }
  }

  // Check for Templated String Fields using the deleted field
  for (const [fId, fieldDef] of Object.entries(scopedFields)) {
    if (fieldDef['component-name'] === 'TemplatedStringField') {
      const template =
        (fieldDef['component-parameters'] as TemplatedStringProps).template ||
        '';

      if (template.includes(`{{${fieldName}}}`)) {
        const label = fieldDef['component-parameters']?.label ?? fId;
        const section = fieldToSection.get(fId);
        const form = section?.sectionId
          ? sectionToForm.get(section.sectionId)
          : undefined;
        affected.push({
          type: 'templated-string',
          formId: form?.formId,
          formLabel: form?.formLabel,
          sectionId: section?.sectionId,
          sectionLabel: section?.sectionLabel,
          fieldId: fId,
          fieldLabel: label,
          templateUsage: `{{${fieldName}}}`,
        });
      }
    }
  }

  return affected;
};

/**
 * findSectionExternalUsage:
 * Checks if any other section references the fields belonging to `targetSectionId`.
 * If so, returns references for display (like "Section: X references your fields").
 *
 * @param targetSectionId The ID of the section you plan to delete.
 * @param allViews All sections (`views` map)
 * @param allFields All fields
 * @returns Array of strings describing external references
 */
export function findSectionExternalUsage(
  targetSectionId: string,
  allViews: ViewMap,
  allFields: FieldMap
): string[] {
  const references: string[] = [];

  // 1. gather all fields that belong to the target section
  const targetFields = allViews[targetSectionId]?.fields || [];

  // 2. For each section in `views`
  for (const [sectionId, sectionDef] of Object.entries(allViews)) {
    // If it's the same section, skip. Self-contained references are okay if you're deleting the whole section
    if (sectionId === targetSectionId) continue;

    // 2a. check section-level condition
    const sectionCond = sectionDef.condition;
    if (
      sectionCond &&
      targetFields.some(f => isFieldUsedInCondition(sectionCond, f))
    ) {
      references.push(`Section: ${sectionDef.label}`);
    }

    // 2b. check each field in that section
    for (const fieldName of sectionDef.fields) {
      const fieldCond = allFields[fieldName]?.condition;
      if (
        fieldCond &&
        targetFields.some(f => isFieldUsedInCondition(fieldCond, f))
      ) {
        const label =
          allFields[fieldName]?.['component-parameters']?.label || fieldName;
        references.push(`Field: ${label} (section: ${sectionDef.label})`);
      }
    }
  }

  return references;
}

/**
 * findFormExternalUsage:
 * Similar logic to findSectionExternalUsage, treats the entire form (across all its sections) as the target,
 * Then we see if other forms' conditions reference any of this form's fields.
 *
 * @param targetFormId The ID of the form you plan to delete
 * @param viewsets All forms
 * @param allViews All sections (`views` map)
 * @param allFields All fields
 * @returns Array of strings describing references from outside forms
 */
export function findFormExternalUsage(
  targetFormId: string,
  viewsets: Record<string, {label: string; views: string[]}>,
  allViews: ViewMap,
  allFields: FieldMap
): string[] {
  const references: string[] = [];

  const targetFormDef = viewsets[targetFormId];
  if (!targetFormDef) return references;

  // 1. gather all fields across all sections in the target form
  const targetFields: string[] = [];
  for (const sectionId of targetFormDef.views) {
    targetFields.push(...(allViews[sectionId]?.fields || []));
  }

  // 2. For each form in viewsets
  for (const [formId, formDef] of Object.entries(viewsets)) {
    if (formId === targetFormId) continue; // skip same form

    // 2a. for each section in that form
    for (const secId of formDef.views) {
      const secDef = allViews[secId];
      if (!secDef) continue;
      // check section-level condition
      if (
        secDef.condition &&
        targetFields.some(f => isFieldUsedInCondition(secDef.condition, f))
      ) {
        references.push(`Section: ${secDef.label} (Form: ${formDef.label})`);
      }

      // check each field
      for (const fieldName of secDef.fields) {
        const fieldCond = allFields[fieldName]?.condition;
        if (
          fieldCond &&
          targetFields.some(f => isFieldUsedInCondition(fieldCond, f))
        ) {
          const label =
            allFields[fieldName]?.['component-parameters']?.label || fieldName;
          references.push(
            `Field: ${label} (Form: ${formDef.label}, Section: ${secDef.label})`
          );
        }
      }
    }
  }

  return references;
}

/**
 * Finds fields and sections that have visibility conditions relying on this field
 * and that expect a specific value that no longer exists.
 *
 * @param targetFieldName The name of the field being checked
 * @param targetField The field's definition
 * @param allFields All fields in the form
 * @param allViews All sections (`views` map) in the form
 * @returns An array of messages identifying conditions with missing expected values
 */
export function findInvalidConditionReferences(
  targetFieldName: string,
  targetField: FieldType,
  allFields: Record<string, FieldType>,
  allViews: Record<string, {label: string; condition?: ConditionType}>
): string[] {
  const invalidConditions: string[] = [];

  // Only need to check fields with predefined choices
  if (
    !['Select', 'RadioGroup', 'MultiSelect'].includes(
      targetField['component-name']
    )
  ) {
    return invalidConditions;
  }

  const elementProps = (
    targetField['component-parameters'] as {ElementProps?: ChoiceElementProps}
  ).ElementProps;
  const validOptions: string[] = (
    (elementProps?.options ?? []) as SelectableConditionOption[]
  ).map(opt => opt.value);

  // Check if a condition is using a value that no longer exists
  const getInvalidExpectedValue = (condition: ConditionType): string[] => {
    if (isBooleanCondition(condition)) {
      return condition.conditions
        ? condition.conditions.flatMap(getInvalidExpectedValue)
        : [];
    }

    if (condition.field !== targetFieldName) {
      return [];
    }

    if (Array.isArray(condition.value)) {
      const missingValues = condition.value.filter(
        val => !validOptions.includes(val)
      );
      return missingValues.length > 0
        ? [`expects '${missingValues.join(', ')}'`]
        : [];
    }

    return validOptions.includes(String(condition.value))
      ? []
      : [`expects '${String(condition.value)}'`];
  };

  // Check field conditions
  for (const [fId, fieldDef] of Object.entries(allFields)) {
    const cond = fieldDef.condition;
    if (cond && isFieldUsedInCondition(cond, targetFieldName)) {
      const invalidVals = getInvalidExpectedValue(cond);
      if (invalidVals.length > 0) {
        const label = fieldDef['component-parameters']?.label ?? fId;
        invalidVals.forEach(invalidVal => {
          invalidConditions.push(`Field: ${label} (${invalidVal})`);
        });
      }
    }
  }

  // Check section conditions
  for (const [, viewDef] of Object.entries(allViews)) {
    const cond = viewDef.condition;
    if (cond && isFieldUsedInCondition(cond, targetFieldName)) {
      const invalidVals = getInvalidExpectedValue(cond);
      if (invalidVals.length > 0) {
        invalidVals.forEach(invalidVal => {
          invalidConditions.push(`Section: ${viewDef.label} (${invalidVal})`);
        });
      }
    }
  }

  return invalidConditions;
}
