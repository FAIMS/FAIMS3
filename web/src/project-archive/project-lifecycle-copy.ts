import {FORCE_REMOTE_DELETION, NOTEBOOK_NAME} from '@/constants';

/** Short line for the project actions card (archive list item). */
export function getArchiveProjectActionsDescription(): string {
  if (FORCE_REMOTE_DELETION === 'allow') {
    return `Disable data collection for this ${NOTEBOOK_NAME}. After users open the app, their devices will clear this ${NOTEBOOK_NAME}. Records that were never uploaded will be lost forever.`;
  }
  return `Disable data collection for this ${NOTEBOOK_NAME}. After users open the app, it will deactivate this ${NOTEBOOK_NAME} from their device. While data may be recoverable on some devices, we do not recommend relying on this.`;
}
