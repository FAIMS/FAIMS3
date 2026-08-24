/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Description:
 *   Displays selection instructions and actions while creating an offline map.
 */

import {Alert, Button, Stack, Typography} from '@mui/material';

/** Selection states shown while creating a new offline map. */
export type DownloadOfflineMapStatus =
  | 'drawing' // Drawing active, no first point yet.
  | 'drawing-started' // First point placed.
  | 'pending' // Selection completed, waiting for confirmation.
  | 'confirmed'; // Selection confirmed.

/** Props for {@link DownloadOfflineMapBanner}. */
export type DownloadOfflineMapBannerProps = {
  status: DownloadOfflineMapStatus;
  /** Whether touch-based map selection is being used. */
  isTouchDevice: boolean;
  onClear: () => void;
  onConfirm: () => void;
};

export function DownloadOfflineMapBanner({
  status,
  isTouchDevice,
  onClear,
  onConfirm,
}: DownloadOfflineMapBannerProps) {
  const content = isTouchDevice
    ? status === 'confirmed'
      ? {
          severity: 'success' as const,
          message:
            'Your map selection is confirmed. Select Clear to adjust it again.',
        }
      : {
          severity: 'info' as const,
          message:
            'The area inside the frame will be downloaded. Pan or pinch to adjust it, then confirm when ready.',
        }
    : {
        // Nothing done
        drawing: {
          severity: 'info' as const,
          message:
            'Click on the map to start your selection, then click again to complete it.',
        },
        // Mid way (clicked once)
        'drawing-started': {
          severity: 'info' as const,
          message:
            'Starting point selected. Click again on the map to complete your selection.',
        },
        // Selection completed, waiting for confirmation.
        pending: {
          severity: 'warning' as const,
          message:
            'You have selected an area below. Confirm or clear your selection.',
        },
        // Selection confirmed
        confirmed: {
          severity: 'success' as const,
          message: 'Your map selection is confirmed.',
        },
      }[status];

  const canClear = isTouchDevice
    ? status === 'confirmed'
    : status !== 'drawing';
  const canConfirm = status === 'pending';
  const hideConfirm = status === 'confirmed';

  return (
    <Alert severity={content.severity}>
      <Stack spacing={1}>
        <Typography variant="body2">{content.message}</Typography>

        <Stack direction="row" spacing={1}>
          <Button
            color="error"
            variant="contained"
            onClick={onClear}
            disabled={!canClear}
          >
            Clear
          </Button>

          {!hideConfirm && (
            <Button
              variant="contained"
              onClick={onConfirm}
              disabled={!canConfirm}
            >
              Confirm
            </Button>
          )}
        </Stack>
      </Stack>
    </Alert>
  );
}
