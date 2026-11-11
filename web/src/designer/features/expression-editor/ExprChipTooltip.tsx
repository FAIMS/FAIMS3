// SPDX-License-Identifier: Apache-2.0
/**
 * @file Hover panel for one expression chip.
 *
 * Rendered once at the {@link ExpressionEditor} host (event delegation on
 * `.expr-chip`), not as a React tree per widget. Shows the full
 * {@link ChipModel.label} even when the chip face is truncated.
 */

import {Box, Typography} from '@mui/material';
import {CHIP_KIND_LABELS, exprTypeLabel, type ChipModel} from './chipModel';

/** Props for {@link ExprChipTooltip}. */
export type ExprChipTooltipProps = {
  /** Resolved model for the hovered `{ref}`. */
  model: ChipModel;
};

/**
 * One labelled value row. `minWidth` on the caption keeps the value column
 * aligned; `overflowWrap` lets long storage ids wrap instead of overflowing.
 */
const Row = ({label, value}: {label: string; value: string}) => (
  <Box sx={{display: 'flex', gap: 1, alignItems: 'baseline'}}>
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{minWidth: 72, flexShrink: 0}}
    >
      {label}
    </Typography>
    <Typography
      variant="caption"
      sx={{fontWeight: 600, overflowWrap: 'anywhere'}}
    >
      {value}
    </Typography>
  </Box>
);

/**
 * Compact tooltip body for a resolved expression reference.
 *
 * Kind heading first, then an error (if any), then the optional detail
 * rows. Empty optional fields are omitted so a constant does not show a
 * blank export/location line.
 *
 * @param props.model - Chip model from the catalog (or fallback).
 */
export const ExprChipTooltip = ({model}: ExprChipTooltipProps) => {
  const typeLabel = exprTypeLabel(model.exprType);

  return (
    <Box sx={{p: 1, minWidth: 180, maxWidth: 320}}>
      <Typography
        variant="caption"
        sx={{fontWeight: 700, display: 'block', mb: 0.5}}
      >
        {CHIP_KIND_LABELS[model.kind]}
      </Typography>
      {model.error && (
        <Typography
          variant="caption"
          color="error"
          sx={{display: 'block', mb: 0.75, fontWeight: 600}}
        >
          {model.error}
        </Typography>
      )}
      {/* Full label — not the truncated chip face. */}
      <Row label="Label" value={model.label} />
      {model.exportName && <Row label="Export" value={model.exportName} />}
      <Row label="Id" value={model.ref} />
      {typeLabel && <Row label="Type" value={typeLabel} />}
      {model.location && <Row label="Location" value={model.location} />}
      {model.constantValue !== undefined && (
        <Row label="Value" value={String(model.constantValue)} />
      )}
    </Box>
  );
};
