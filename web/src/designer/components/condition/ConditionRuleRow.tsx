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
 * @file Inputs for editing a single condition rule.
 */

import {
  ConditionEditorActions,
  ConditionRuleNode,
} from '@/designer/types/condition';
import {makeRuleGroupDropId} from '@/lib/conditionUtils';
import {useDraggable, useDroppable} from '@dnd-kit/react';
import {AddBoxOutlined} from '@mui/icons-material';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {Box, IconButton, Paper, Tooltip, Typography} from '@mui/material';
import {
  conditionDropBorderColour,
  designerConditionDropFeedbackSx,
} from '../designer-style';
import {ConditionRuleInputs} from './ConditionRuleInputs';

/**
 * Renders one condition rule row.
 *
 * the row can be dragged, grouped, or deleted.
 *
 */
export type ConditionRuleRowProps = {
  rule: ConditionRuleNode;
  actions: ConditionEditorActions;
  activeDragId: string | null;
  activeDropTargetId: string | null;
  field?: string;
  view?: string;
  // Disables this rule as a drop target.
  // Used when this rule is inside a group currently being dragged.
  disableDropZones?: boolean;
  showLabels?: boolean;
};

export const ConditionRuleRow = (props: ConditionRuleRowProps) => {
  const {
    rule,
    actions,
    activeDragId,
    activeDropTargetId,
    field,
    view,
    disableDropZones = false,
    showLabels = false,
  } = props;

  /**
   * draggableRef marks the whole row as the draggable item.
   * handleRef marks the small drag icon as the drag handle.
   */
  const {
    ref: draggableRef,
    handleRef,
    isDragging,
  } = useDraggable({
    id: rule.editorId,
  });

  const groupDropTargetId = makeRuleGroupDropId(rule.editorId);

  const {ref: droppableRef} = useDroppable({
    id: groupDropTargetId,
  });

  // Highlight this rule only when it is an enabled drop target.
  const isGroupDropTarget =
    !disableDropZones &&
    activeDragId !== null &&
    activeDragId !== rule.editorId &&
    activeDropTargetId === groupDropTargetId;

  return (
    <div ref={draggableRef} style={{width: '100%'}}>
      <Paper
        ref={droppableRef}
        variant="outlined"
        sx={{
          position: 'relative',
          p: 1,
          width: '100%',
          boxSizing: 'border-box',
          borderStyle: 'solid',
          backgroundColor: 'grey.100',
          // dragging styles
          opacity: isDragging ? 0.4 : 1,
          borderColor: isGroupDropTarget
            ? conditionDropBorderColour
            : undefined,
          borderWidth: isGroupDropTarget ? 2 : 0,
          boxShadow: isDragging || isGroupDropTarget ? 2 : 0,
        }}
      >
        {/* Show a feedback chip when dropping here will create a new group. */}
        {isGroupDropTarget && (
          <Typography variant="caption" sx={designerConditionDropFeedbackSx}>
            Drop to create a new group
          </Typography>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 32px 32px 32px',
            gap: 1,
            alignItems: 'center',
            width: '100%',
            minWidth: 0,
          }}
        >
          <Box sx={{minWidth: 0}}>
            <ConditionRuleInputs
              rule={rule}
              field={field}
              view={view}
              onChange={patch => actions.updateRule(rule.editorId, patch)}
              showLabels={showLabels}
            />
          </Box>

          {/* Wrap this condition in a group button */}
          <Tooltip title="Create an AND or OR group from this condition">
            <IconButton
              size="small"
              sx={{width: 32, height: 32}}
              onPointerDown={event => event.stopPropagation()}
              onClick={event => {
                event.stopPropagation();
                actions.wrapRuleInGroup(rule.editorId, 'and');
              }}
              data-testid="split-button"
            >
              <AddBoxOutlined fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Delete condition button */}
          <Tooltip title="Remove this condition">
            <IconButton
              size="small"
              color="error"
              sx={{width: 32, height: 32}}
              onPointerDown={event => event.stopPropagation()}
              onClick={event => {
                event.stopPropagation();
                actions.deleteNode(rule.editorId);
              }}
              data-testid="delete-button"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Drag condition button */}
          <Tooltip title="Drag condition">
            <Box
              ref={handleRef}
              sx={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.secondary',
                cursor: isDragging ? 'grabbing' : 'grab',
              }}
            >
              <DragIndicatorIcon fontSize="small" />
            </Box>
          </Tooltip>
        </Box>
      </Paper>
    </div>
  );
};
