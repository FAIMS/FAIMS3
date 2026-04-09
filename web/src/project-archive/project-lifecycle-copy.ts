import {
  FORCE_REMOTE_DELETION,
  NOTEBOOK_NAME,
  NOTEBOOK_NAME_CAPITALIZED,
} from '@/constants';

/** Main paragraph for the archive confirmation dialog. */
export function getArchiveProjectDialogBody(): string {
  if (FORCE_REMOTE_DELETION === 'allow') {
    return [
      `Archiving hides this ${NOTEBOOK_NAME_CAPITALIZED} from normal lists.`,
      `Be absolutely sure every field user has uploaded their records before you archive. After users open the app, it will wipe this ${NOTEBOOK_NAME} from their device. Anything that was not uploaded will be lost forever and cannot be recovered.`,
    ].join(' ');
  }
  return [
    `Archiving hides this ${NOTEBOOK_NAME_CAPITALIZED} from normal lists.`,
    `People should sync first so the server has their latest work. After users open the app, it will deactivate this ${NOTEBOOK_NAME} from their device. While data may be recoverable on some devices, we do not recommend relying on this.`,
  ].join(' ');
}

/** Short line for the project actions card (archive list item). */
export function getArchiveProjectActionsDescription(): string {
  if (FORCE_REMOTE_DELETION === 'allow') {
    return `Hide this ${NOTEBOOK_NAME} from normal lists. After users open the app, their devices may wipe this ${NOTEBOOK_NAME}. Records that were never uploaded can be lost forever.`;
  }
  return `Hide this ${NOTEBOOK_NAME} from normal lists. After users open the app, it will deactivate this ${NOTEBOOK_NAME} from their device. While data may be recoverable on some devices, we do not recommend relying on this.`;
}

/** Destructive alert under the archive dialog — unsynced / local-data behaviour. */
export function getArchiveProjectUnsyncedAlertDescription(): string {
  if (FORCE_REMOTE_DELETION === 'allow') {
    return `Do not archive until every field user has synced. After users open the app, it will wipe this ${NOTEBOOK_NAME} from their device. Anything still only on a device will be gone for good.`;
  }
  return `Ask every field user to sync before you archive so the server has their latest records. After users open the app, it will deactivate this ${NOTEBOOK_NAME} from their device. While data may be recoverable on some devices, we do not recommend relying on this.`;
}

/** Intro bullets for the permanent delete (destroy) archived project dialog. */
export function getDeleteArchivedProjectDialogIntro(): readonly string[] {
  if (FORCE_REMOTE_DELETION === 'allow') {
    return [
      `This permanently deletes all records for this ${NOTEBOOK_NAME}. That cannot be undone.`,
      `Be absolutely sure every user has uploaded from their devices first. After users open the app, it will wipe this ${NOTEBOOK_NAME} from their device; anything not uploaded is lost forever.`,
      'Export or download anything you need from the server before you continue.',
    ] as const;
  }
  return [
    `This permanently deletes all records for this ${NOTEBOOK_NAME}. This cannot be undone.`,
    `Be absolutely sure every user has uploaded from their devices first. After users open the app, it will deactivate this ${NOTEBOOK_NAME} from their device; anything not uploaded is lost forever.`,
    'Export or download anything you need before you continue.',
  ] as const;
}
