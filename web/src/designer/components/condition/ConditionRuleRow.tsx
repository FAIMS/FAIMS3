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
import {useConditionRuleFieldContext} from '@/hooks/use-condition-field-context';
import {useDraggable} from '@dnd-kit/react';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {Box, IconButton, Paper, Tooltip, Typography} from '@mui/material';
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
  field?: string;
  view?: string;
};

export const ConditionRuleRow = (props: ConditionRuleRowProps) => {
  const {rule, actions, field, view} = props;

  const {selectableFieldCount} = useConditionRuleFieldContext({
    field,
    view,
  });

  /**
   * ref marks the whole row as the draggable item.
   * handleRef marks the small drag icon as the drag handle.
   */
  const {ref, handleRef, isDragging} = useDraggable({
    id: rule.editorId,
  });

  // If there are no fields to select, show a message instead of the editor.
  if (selectableFieldCount <= 0) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <Typography variant="body2" color="error">
          {view ? (
            <>
              This form has only one section. Adding conditions for a section
              requires more than one section so that fields from other sections
              can be referenced.
            </>
          ) : (
            <>
              This form only has one field. Please add fields to this form to
              enable adding conditions.
            </>
          )}
        </Typography>
      </Paper>
    );
  }

  return (
    <div ref={ref} style={{width: '100%'}}>
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          width: '100%',
          boxSizing: 'border-box',
          // dragging styles
          opacity: isDragging ? 0.4 : 1,
          boxShadow: isDragging ? 2 : 0,
        }}
      >
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
            />
          </Box>

          {/* Wrap this condition in a group button */}
          <Tooltip title="Make this an 'And' or 'OR' condition">
            <IconButton
              size="small"
              color="success"
              sx={{width: 32, height: 32}}
              onPointerDown={event => event.stopPropagation()}
              onClick={event => {
                event.stopPropagation();
                actions.wrapRuleInGroup(rule.editorId, 'and');
              }}
              data-testid="split-button"
            >
              <AddBoxIcon fontSize="small" />
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
        </Box>
      </Paper>
    </div>
  );
};
