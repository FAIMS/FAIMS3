// SPDX-License-Identifier: Apache-2.0
import {ProgressBar} from '@faims3/forms';
import {Button, Stack} from '@mui/material';
import type {SxProps, Theme} from '@mui/material/styles';

/** Idle label, else percent after the first byte, else a preparing state. */
export function mapLayerDownloadLabel(
  active: boolean,
  idle: string,
  completion: number | null
): string {
  if (!active) {
    return idle;
  }
  if (completion !== null && completion > 0) {
    return `Downloading… ${Math.round(completion * 100)}%`;
  }
  return 'Preparing download…';
}

/** Progress bar plus cancel control for an in-flight map-layer download. */
export function MapLayerDownloadProgress({
  completion,
  cancelling,
  onCancel,
  sx,
  cancelSize,
}: {
  completion: number | null;
  cancelling: boolean;
  onCancel: () => void;
  sx?: SxProps<Theme>;
  cancelSize?: 'small' | 'medium';
}) {
  return (
    <Stack spacing={1.5} sx={sx} data-testid="map-layer-download-progress">
      <ProgressBar completion={completion ?? 0} />
      <Button
        variant="outlined"
        size={cancelSize}
        onClick={onCancel}
        disabled={cancelling}
        data-testid="map-layer-download-cancel"
      >
        {cancelling ? 'Cancelling…' : 'Cancel download'}
      </Button>
    </Stack>
  );
}
