import {config} from '@/constants';

/** Short line for the project actions card (archive list item). */
export function getArchiveProjectActionsDescription(): string {
  if (config.forceRemoteDeletion === 'allow') {
    return `Disable data collection for this ${config.notebookName}. After users open the app, their devices will clear this ${config.notebookName}. Records that were never uploaded will be lost forever.`;
  }
  return `Disable data collection for this ${config.notebookName}. After users open the app, it will deactivate this ${config.notebookName} from their device. While data may be recoverable on some devices, we do not recommend relying on this.`;
}
