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
 * @file Drop slot UI for the condition editor.
 *
 * Provides indexed drop targets used to move rules and groups within the
 * condition tree.
 */

import {useDroppable} from '@dnd-kit/react';
import {Box, Typography} from '@mui/material';
import {makeIndexedDropId} from '../../../lib/conditionUtils';
import {
  conditionDropBorderColour,
  designerConditionDropFeedbackSx,
} from '../designer-style';

/**
 * Renders an indexed drop slot inside a condition group.
 *
 * @param props.groupId - The editor ID of the group that owns this drop slot.
 * @param props.index - The insert position inside the group.
 * @param props.isDragging - Whether a condition item is currently being dragged.
 * @param props.activeDropTargetId - The currently active drop target ID.
 * @param props.disabled - Whether this drop slot should be ignored.
 */
export type ConditionDropZoneProps = {
  groupId: string;
  index: number;
  isDragging: boolean;
  activeDropTargetId: string | null;
  disabled?: boolean;
};
export const ConditionDropZone = (props: ConditionDropZoneProps) => {
  const id = makeIndexedDropId(props.groupId, props.index);
  const {ref} = useDroppable({id});

  const isActive = props.activeDropTargetId === id;
  const isVisible = props.isDragging && !props.disabled;

  return (
    <Box
      ref={ref}
      sx={{
        /**
         * Keep this height stable all the time.
         * That avoids the modal jumping taller/shorter when dragging starts.
         */
        height: 24,
        position: 'relative',
        visibility: isVisible ? 'visible' : 'hidden',
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
    >
      {isVisible && (
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            borderTop: '2px dashed',
            borderColor: isActive ? conditionDropBorderColour : 'transparent',
          }}
        >
          {/* Show a feedback chip for the active drop target. */}
          {isActive && (
            <Typography variant="caption" sx={designerConditionDropFeedbackSx}>
              Drop here
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};
