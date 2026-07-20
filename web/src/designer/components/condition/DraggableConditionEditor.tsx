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
 * @file Drag/drop condition editor.
 *
 */

import {
  ConditionEditorActions,
  ConditionGroupNode,
} from '@/designer/types/condition';
import {getGroupChildCount, parseDropTarget} from '@/lib/conditionUtils';
import {DragDropProvider} from '@dnd-kit/react';
import {type ComponentProps, useState} from 'react';
import {ConditionGroupCard} from './ConditionGroupCard';

type DragStartHandler = NonNullable<
  ComponentProps<typeof DragDropProvider>['onDragStart']
>;
type DragOverHandler = NonNullable<
  ComponentProps<typeof DragDropProvider>['onDragOver']
>;
type DragEndHandler = NonNullable<
  ComponentProps<typeof DragDropProvider>['onDragEnd']
>;

/**
 * Renders the condition editor with drag/drop support.
 */
export const DraggableConditionEditor = (props: {
  root: ConditionGroupNode;
  actions: ConditionEditorActions;
  field?: string;
  view?: string;
}) => {
  const {root, actions} = props;

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDropTargetId, setActiveDropTargetId] = useState<string | null>(
    null
  );

  const handleDragStart: DragStartHandler = event => {
    const sourceId = event.operation.source?.id;
    setActiveDragId(sourceId ? String(sourceId) : null);
  };

  const handleDragOver: DragOverHandler = event => {
    const targetId = event.operation.target?.id;
    setActiveDropTargetId(targetId ? String(targetId) : null);
  };

  const handleDragEnd: DragEndHandler = event => {
    setActiveDragId(null);
    setActiveDropTargetId(null);

    if (event.canceled) return;

    const sourceId = event.operation.source?.id;
    const targetId = event.operation.target?.id;

    if (!sourceId || !targetId) return;

    const parsedTarget = parseDropTarget(String(targetId));
    if (!parsedTarget) return;

    if (parsedTarget.type === 'rule') {
      actions.groupNodeWithRule(String(sourceId), parsedTarget.ruleId);
      return;
    }

    const targetIndex =
      parsedTarget.index ?? getGroupChildCount(root, parsedTarget.groupId);

    actions.moveNode(String(sourceId), parsedTarget.groupId, targetIndex);
  };

  return (
    <DragDropProvider
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <ConditionGroupCard
        group={root}
        isRoot
        field={props.field}
        view={props.view}
        actions={actions}
        activeDragId={activeDragId}
        activeDropTargetId={activeDropTargetId}
      />
    </DragDropProvider>
  );
};
