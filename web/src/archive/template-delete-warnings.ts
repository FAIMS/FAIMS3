import {
  NOTEBOOK_NAME_CAPITALIZED,
  NOTEBOOK_NAME_PLURAL,
  NOTEBOOK_NAME_PLURAL_CAPITALIZED,
} from '@/constants';

/** Central strings for the archived-template delete dialog — edit here only. */
export const templateDeleteDialogLabels = {
  menuItem: 'Delete permanently',
  title: 'Permanently delete template',
  introBefore: 'Are you sure you want to permanently delete ',
  introAfter: '. This cannot be undone.',
  cancel: 'Cancel',
  confirm: 'Delete permanently',
  loadingReferences: `Loading ${NOTEBOOK_NAME_CAPITALIZED} references…`,
  loadError: 'Could not load reference count. Try again or contact support.',
} as const;

/**
 * Body copy from the number of notebooks still linked to the template.
 * When `linkedWarningText` is set, show it in the red warning panel.
 */
export function getTemplateDeleteDialogBody({
  templateName,
  referencingNotebookCount,
}: {
  templateName: string;
  referencingNotebookCount: number;
}): {
  nameLabel: string;
  linkedWarningText: string | null;
} {
  const nameLabel = templateName.trim() || 'this template';
  const nbCap = NOTEBOOK_NAME_CAPITALIZED;
  const nbPlural = NOTEBOOK_NAME_PLURAL;
  const nbPluralCap = NOTEBOOK_NAME_PLURAL_CAPITALIZED;

  if (referencingNotebookCount === 0) {
    return {nameLabel, linkedWarningText: null};
  }

  const n = referencingNotebookCount;
  const countPhrase =
    n === 1 ? `one ${nbCap}` : `${n} ${nbPlural}`;
  const isAre = n === 1 ? 'is' : 'are';

  const consequence =
    n === 1
      ? `The ${nbCap} and its data will not be deleted; the link between the ${nbCap} and this template will be removed, which means you will not be able to track which template the ${nbCap} was created from.`
      : `The ${nbPluralCap} and their data will not be deleted; the links between the ${nbPluralCap} and this template will be removed, which means you will not be able to track which template the ${nbPluralCap} were created from.`;

  const linkedWarningText = `Please note ${countPhrase} ${isAre} linked to this template. ${consequence}`;

  return {nameLabel, linkedWarningText};
}
