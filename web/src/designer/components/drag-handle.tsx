import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {Box, IconButton, Tooltip} from '@mui/material';
import type {MouseEventHandler, PointerEventHandler} from 'react';
import type {DraggableAttributes} from '@dnd-kit/core';

type DragHandleProps = {
  label?: string;
  compact?: boolean;
  onPointerDown?: PointerEventHandler<HTMLElement>;
  onClick?: MouseEventHandler<HTMLElement>;
  dragAttributes?: DraggableAttributes;
  dragListeners?: unknown;
};

/**
 * Reusable dotted drag handle for sortable rows.
 *
 * The component accepts DnD listeners/attributes so any list item can opt into
 * drag-to-reorder while keeping a consistent affordance across the Designer UI.
 */
export const DragHandle = ({
  label = 'Drag to reorder',
  compact = false,
  onPointerDown,
  onClick,
  dragAttributes,
  dragListeners,
}: DragHandleProps) => {
  return (
    <Tooltip title={label}>
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconButton
          size={compact ? 'small' : 'medium'}
          sx={{
            cursor: 'grab',
            color: 'text.secondary',
            '&:active': {cursor: 'grabbing'},
          }}
          onPointerDown={onPointerDown}
          onClick={onClick}
          {...dragAttributes}
          {...(dragListeners as object)}
        >
          <DragIndicatorIcon fontSize={compact ? 'small' : 'medium'} />
        </IconButton>
      </Box>
    </Tooltip>
  );
};
