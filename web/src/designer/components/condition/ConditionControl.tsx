// SPDX-License-Identifier: Apache-2.0

/**
 * @file Entry point for the condition editor.
 */

import {
  addRuleToGroup,
  conditionToEditorTree,
  deleteNodeFromTree,
  editorTreeToCondition,
  groupNodeWithRuleInTree,
  moveNodeInTree,
  ROOT_CONDITION_GROUP_ID,
  ungroupNode,
  updateGroupOperator,
  updateRuleNode,
  wrapRuleInGroup,
} from '@/lib/conditionUtils';
import {Stack, Typography} from '@mui/material';
import {useCallback, useEffect, useMemo, useState} from 'react';
import type {
  ConditionBooleanOperator,
  ConditionEditorActions,
  ConditionGroupNode,
  ConditionType,
  RuleCondition,
} from '../../types/condition';
import {ConditionSummary} from './ConditionSummary';
import {DraggableConditionEditor} from './DraggableConditionEditor';

/**
 * Main condition editor used by ConditionModal.
 */
export type ConditionControlProps = {
  onChange?: (condition: ConditionType | null) => void;
  initial?: ConditionType | null;
  /** When set, restricts which fields can be chosen (e.g. same-section rules). */
  field?: string;
  view?: string;
};

export const ConditionControl = (props: ConditionControlProps) => {
  // Editor tree used by the draggable condition UI.
  const [root, setRoot] = useState<ConditionGroupNode>(() =>
    conditionToEditorTree(props.initial ?? null)
  );

  // Persisted condition generated from the editor tree.
  const condition = useMemo(() => editorTreeToCondition(root), [root]);

  useEffect(() => {
    // Notify parent component when the editor tree produces a new condition.
    props.onChange?.(condition);
  }, [condition]);

  const commitRoot = useCallback(
    (updater: (current: ConditionGroupNode) => ConditionGroupNode) => {
      setRoot(current => updater(current));
    },
    []
  );

  const conditionEditorActions = useMemo<ConditionEditorActions>(
    () => ({
      updateRule: (nodeId: string, patch: Partial<RuleCondition>) =>
        commitRoot(current => updateRuleNode(current, nodeId, patch)),

      addRule: (groupId: string) =>
        commitRoot(current => addRuleToGroup(current, groupId)),

      updateRootOperator: (operator: ConditionBooleanOperator) =>
        commitRoot(current =>
          updateGroupOperator(current, ROOT_CONDITION_GROUP_ID, operator)
        ),

      updateGroupOperator: (
        groupId: string,
        operator: ConditionBooleanOperator
      ) =>
        commitRoot(current => updateGroupOperator(current, groupId, operator)),

      deleteNode: (nodeId: string) =>
        commitRoot(current => deleteNodeFromTree(current, nodeId)),

      moveNode: (nodeId: string, targetGroupId: string, targetIndex: number) =>
        commitRoot(current =>
          moveNodeInTree(current, nodeId, targetGroupId, targetIndex)
        ),

      groupNodeWithRule: (
        nodeId: string,
        targetRuleId: string,
        operator: ConditionBooleanOperator = 'and'
      ) =>
        commitRoot(current =>
          groupNodeWithRuleInTree(current, nodeId, targetRuleId, operator)
        ),

      wrapRuleInGroup: (
        nodeId: string,
        operator: ConditionBooleanOperator = 'and'
      ) => commitRoot(current => wrapRuleInGroup(current, nodeId, operator)),

      ungroup: (groupId: string) =>
        commitRoot(current => ungroupNode(current, groupId)),
    }),
    [commitRoot]
  );

  return (
    <Stack direction="column" spacing={2}>
      <Typography variant="h6">Condition editor</Typography>

      <ConditionSummary condition={condition} showTitle={true} />

      <DraggableConditionEditor
        root={root}
        field={props.field}
        view={props.view}
        actions={conditionEditorActions}
      />
    </Stack>
  );
};
