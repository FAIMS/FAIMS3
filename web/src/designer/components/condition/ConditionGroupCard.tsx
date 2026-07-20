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
 * @file Condition group card UI.
 *
 */

import {
  ConditionBooleanOperator,
  conditionBooleanOperatorColours,
  ConditionEditorActions,
  ConditionGroupNode,
} from '@/designer/types/condition';
import {useDraggable} from '@dnd-kit/react';
import AddIcon from '@mui/icons-material/Add';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {Fragment} from 'react';
import {
  isActiveGroupDropTarget,
  isNoOpDropIndex,
} from '../../../lib/conditionUtils';
import {ConditionDropZone} from './ConditionDropZone';
import {ConditionRuleRow} from './ConditionRuleRow';
import {BooleanOperatorTooltip} from './ConditionTooltips';

/**
 * Renders a condition group and its child rules/groups.
 *
 * Non-root groups can be dragged, ungrouped, or deleted. The root group stays
 * fixed and only provides the top-level condition structure.
 *
 * @param props - Group card props.
 * @returns A condition group card component.
 */
export type ConditionGroupCardProps = {
  group: ConditionGroupNode;
  actions: ConditionEditorActions;
  activeDragId: string | null;
  activeDropTargetId: string | null;
  isRoot?: boolean;
  field?: string;
  view?: string;
  //Disables drop zones inside this group.
  //sed when this group or one of its parent groups is being dragged.
  disableDropZones?: boolean;
};

export const ConditionGroupCard = (props: ConditionGroupCardProps) => {
  const {
    group,
    actions,
    activeDragId,
    activeDropTargetId,
    isRoot = false,
    field,
    view,
    disableDropZones = false,
  } = props;

  const {
    ref: draggableRef,
    handleRef,
    isDragging: isThisGroupDragging,
  } = useDraggable({
    id: group.editorId,
  });

  const isGroupDraggable = !isRoot;
  const isDragging = activeDragId !== null;

  /**
   * Disable both this group's drop slots and highlight when this group, or one of
   * its parent groups, is being dragged.
   */
  const disabledInsideThisGroup = disableDropZones || isThisGroupDragging;

  // Highlight this group only when one of its enabled drop slots is active.
  const isGroupTarget =
    !disabledInsideThisGroup &&
    isActiveGroupDropTarget(activeDropTargetId, group.editorId);

  // Find the dragged item's current position in this group, if it belongs here.
  const draggedChildIndex = activeDragId
    ? group.children.findIndex(child => child.editorId === activeDragId)
    : -1;

  return (
    <Paper
      ref={isGroupDraggable ? draggableRef : undefined}
      variant={'outlined'}
      elevation={0}
      sx={{
        p: 2,
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'visible',
        // dragging styles
        opacity: isThisGroupDragging ? 0.4 : 1,
        borderColor: isGroupTarget
          ? 'success.main'
          : conditionBooleanOperatorColours[group.operator],
        borderWidth: isGroupTarget ? 2 : 1,
        borderStyle: isGroupTarget ? 'solid' : 'dotted',
        boxShadow: isThisGroupDragging || isGroupTarget ? 2 : 0,
      }}
    >
      <Stack spacing={0}>
        <Stack
          direction="row"
          sx={{
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 1,
          }}
        >
          {/* Group operator selection */}
          <Stack direction="row" spacing={1} sx={{alignItems: 'center'}}>
            <Typography variant="subtitle2">
              {isRoot ? 'Root group' : 'Group'}
            </Typography>

            <FormControl size="small" sx={{minWidth: 120}}>
              <InputLabel id={`operator-${group.editorId}`}>
                <Box
                  component="span"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  Operator
                  <BooleanOperatorTooltip />
                </Box>
              </InputLabel>
              <Select
                label="Operator"
                value={group.operator}
                onChange={event =>
                  actions.updateGroupOperator(
                    group.editorId,
                    event.target.value as ConditionBooleanOperator
                  )
                }
              >
                <MenuItem value="and">AND</MenuItem>
                <MenuItem value="or">OR</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {/* Drag group button */}
          {!isRoot && (
            <Tooltip title="Drag group">
              <Box
                ref={handleRef}
                sx={{
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'text.secondary',
                  cursor: isThisGroupDragging ? 'grabbing' : 'grab',
                }}
              >
                <DragIndicatorIcon fontSize="small" />
              </Box>
            </Tooltip>
          )}
        </Stack>

        <ConditionDropZone
          groupId={group.editorId}
          index={0}
          isDragging={isDragging}
          disabled={
            disabledInsideThisGroup || isNoOpDropIndex(0, draggedChildIndex)
          }
          activeDropTargetId={activeDropTargetId}
        />

        {group.children.map((child, index) => (
          <Fragment key={child.editorId}>
            {index > 0 && (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  pl: 1,
                  color: conditionBooleanOperatorColours[group.operator],
                  fontWeight: 800,
                }}
              >
                {group.operator.toUpperCase()}
              </Typography>
            )}

            {child.type === 'group' ? (
              <ConditionGroupCard
                group={child}
                field={field}
                view={view}
                actions={actions}
                activeDragId={activeDragId}
                activeDropTargetId={activeDropTargetId}
                disableDropZones={disabledInsideThisGroup}
              />
            ) : (
              <ConditionRuleRow
                rule={child}
                field={field}
                view={view}
                actions={actions}
                activeDragId={activeDragId}
                activeDropTargetId={activeDropTargetId}
              />
            )}

            <ConditionDropZone
              groupId={group.editorId}
              index={index + 1}
              isDragging={isDragging}
              disabled={
                disabledInsideThisGroup ||
                isNoOpDropIndex(index + 1, draggedChildIndex)
              }
              activeDropTargetId={activeDropTargetId}
            />
          </Fragment>
        ))}

        {/* Group actions */}
        <Stack
          direction="row"
          spacing={1}
          sx={{
            pt: 1.5,
            mt: 1,
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Button
            size="small"
            variant="contained"
            color="success"
            startIcon={<AddIcon />}
            onClick={() => actions.addRule(group.editorId)}
          >
            Add condition
          </Button>

          {!isRoot && (
            <Button
              size="small"
              variant="contained"
              color="warning"
              startIcon={<CallSplitIcon />}
              onClick={() => actions.ungroup(group.editorId)}
            >
              Ungroup
            </Button>
          )}

          {!isRoot && (
            <Button
              size="small"
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => actions.deleteNode(group.editorId)}
            >
              Delete group
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
};
