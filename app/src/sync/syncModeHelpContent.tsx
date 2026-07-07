import {Box} from '@mui/material';
import {config} from '../buildconfig';
import type {SyncMode} from './syncMode';

/** Modes shown in sync mode help and change confirmations. */
export const SYNC_MODE_HELP_MODES: SyncMode[] = ['none', 'push', 'both'];

export function showsLargeRecordNote(recordCount?: number): boolean {
  return (
    recordCount !== undefined &&
    recordCount > config.syncPushOnlyRecordThreshold
  );
}

type SyncModeHelpContentProps = {
  mode: SyncMode;
  recordCount?: number;
};

export function SyncModeHelpContent({
  mode,
  recordCount,
}: SyncModeHelpContentProps) {
  switch (mode) {
    case 'none':
      return (
        <>
          Records will only be saved to this device and are not uploaded to the
          server. To upload your records, switch to &ldquo;Upload only&rdquo; or
          &ldquo;Upload and download&rdquo;.
        </>
      );
    case 'push':
      return (
        <>
          Your records will be uploaded to the server, but other users&apos;
          records will not be available on this device.
        </>
      );
    case 'both':
      return (
        <>
          Your records will be uploaded to the server, and other users&apos;
          records will be available on this device.
          {showsLargeRecordNote(recordCount) ? (
            <Box component="span" sx={{display: 'block', mt: 1}}>
              <strong>Note:</strong> this {config.notebookName} has{' '}
              {recordCount!.toLocaleString()} records. Downloading a large
              number of records may consume a large amount of bandwidth, storage
              and battery.
            </Box>
          ) : null}
        </>
      );
    case 'pull':
      return (
        <>
          Records from the server will download to this device, but local edits
          will not upload until you change sync mode.
        </>
      );
    default:
      return null;
  }
}
