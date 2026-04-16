import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {Box, IconButton, Tooltip} from '@mui/material';

type DragHandleProps = {
  label?: string;
  compact?: boolean;
  onPointerDown?: React.PointerEventHandler<HTMLElement>;
  onClick?: React.MouseEventHandler<HTMLElement>;
  dragAttributes?: Record<string, unknown>;
  dragListeners?: Record<string, unknown>;
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
          {...dragListeners}
        >
          <DragIndicatorIcon fontSize={compact ? 'small' : 'medium'} />
        </IconButton>
      </Box>
    </Tooltip>
  );
};

