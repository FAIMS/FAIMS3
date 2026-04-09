import {FORCE_REMOTE_DELETION, NOTEBOOK_NAME} from '@/constants';

/** Short line for the project actions card (archive list item). */
export function getArchiveProjectActionsDescription(): string {
  if (FORCE_REMOTE_DELETION === 'allow') {
    return `Hide this ${NOTEBOOK_NAME} from normal lists. After users open the app, their devices may wipe this ${NOTEBOOK_NAME}. Records that were never uploaded can be lost forever.`;
  }
  return `Hide this ${NOTEBOOK_NAME} from normal lists. After users open the app, it will deactivate this ${NOTEBOOK_NAME} from their device. While data may be recoverable on some devices, we do not recommend relying on this.`;
}
