import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';

/** Copy for archive confirmation — remote deletion warning depends on app deployment. */
export function getArchiveProjectDialogBody(): string {
  return [
    `Archiving hides this ${NOTEBOOK_NAME_CAPITALIZED} from normal lists.`,
    `Depending on your organisation’s mobile app configuration, archiving may also trigger removal of local ${NOTEBOOK_NAME} data on field devices. Any data not yet synced to the server would be lost.`,
    'Ensure everyone has synced before you continue.',
  ].join(' ');
}

export const deleteArchivedProjectDialogIntro = [
  `This permanently destroys all submitted records for this ${NOTEBOOK_NAME} on the server. Recovery is not possible.`,
  'Field devices may still hold local copies until they sync; unsynced device data will be lost.',
  'Export any data you need before continuing.',
] as const;
