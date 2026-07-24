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
  ConditionEditorActions,
  ConditionGroupNode,
} from '@/designer/types/condition';
import {useDraggable} from '@dnd-kit/react';
import {AddCircle} from '@mui/icons-material';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  Box,
  Button,
  FormControl,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {Fragment} from 'react';
import {
  getFirstRuleEditorId,
  isActiveGroupDropTarget,
  isNoOpDropIndex,
} from '../../../lib/conditionUtils';
import {
  conditionBooleanOperatorColours,
  conditionDropBorderColour,
} from '../designer-style';
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
  // Disables drop zones inside this group.
  // Used when this group or one of its parent groups is being dragged.
  disableDropZones?: boolean;
  // the first condition rule in display order.
  firstRuleEditorId?: string | null;
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
    firstRuleEditorId,
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

  // Only show input labels and tooltips for the first row.
  // show group operator tooltip
  const showBoolenOperatorTooltip = isRoot;
  // Resolve the first visible rule once, then pass it through nested groups.
  const firstRuleId =
    firstRuleEditorId !== undefined
      ? firstRuleEditorId
      : isRoot
        ? getFirstRuleEditorId(group)
        : null;

  return (
    <Paper
      ref={isGroupDraggable ? draggableRef : undefined}
      variant={'outlined'}
      elevation={0}
      sx={{
        p: 1.5,
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'visible',
        borderStyle: 'solid',
        // dragging styles
        opacity: isThisGroupDragging ? 0.4 : 1,
        borderColor: isGroupTarget
          ? conditionDropBorderColour
          : conditionBooleanOperatorColours[group.operator],
        borderWidth: isGroupTarget ? 2 : 1,
        boxShadow: isThisGroupDragging || isGroupTarget ? 2 : 0,
      }}
      data-testid={
        isRoot ? 'root-condition-group-card' : 'condition-group-card'
      }
    >
      <Stack spacing={0}>
        <Stack
          direction="row"
          sx={{
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          {/* Group operator selection */}
          <Stack direction="row" spacing={1} sx={{alignItems: 'center'}}>
            <Typography
              variant="subtitle2"
              component="div"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {isRoot ? 'Base group' : 'Group'}
              {showBoolenOperatorTooltip && <BooleanOperatorTooltip />}
            </Typography>

            <FormControl size="small" sx={{minWidth: 90}}>
              <Select
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

          {/* Group actions buttons */}
          <Stack direction="row" spacing={1} sx={{alignItems: 'center'}}>
            {/* Ungroup group button */}
            {!isRoot && (
              <Tooltip title="Remove the group structure while keeping its conditions">
                <Button
                  size="small"
                  variant="text"
                  color="warning"
                  startIcon={<CallSplitIcon />}
                  onClick={() => actions.ungroup(group.editorId)}
                  data-testid="condition-ungroup-button"
                >
                  Ungroup
                </Button>
              </Tooltip>
            )}

            {/* Delete group button */}
            {!isRoot && (
              <Tooltip title="Delete this group and all conditions inside it">
                <Button
                  size="small"
                  variant="text"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => actions.deleteNode(group.editorId)}
                  data-testid="condition-delete-group-button"
                >
                  Delete group
                </Button>
              </Tooltip>
            )}

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
            {child.type === 'group' ? (
              <ConditionGroupCard
                group={child}
                field={field}
                view={view}
                actions={actions}
                activeDragId={activeDragId}
                activeDropTargetId={activeDropTargetId}
                disableDropZones={disabledInsideThisGroup}
                firstRuleEditorId={firstRuleId}
              />
            ) : (
              <ConditionRuleRow
                rule={child}
                field={field}
                view={view}
                actions={actions}
                activeDragId={activeDragId}
                activeDropTargetId={activeDropTargetId}
                disableDropZones={disabledInsideThisGroup}
                showLabels={child.editorId === firstRuleId}
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

        {/* Add a new condition at the end of this group. */}
        <Tooltip title="Add a new condition to the end of this group">
          <Button
            fullWidth
            size="small"
            variant="outlined"
            color="success"
            startIcon={<AddCircle />}
            onClick={() => actions.addRule(group.editorId)}
            sx={{
              py: 1,
              justifyContent: 'center',
            }}
            data-testid="add-condition-button"
          >
            Add condition
          </Button>
        </Tooltip>
      </Stack>
    </Paper>
  );
};
