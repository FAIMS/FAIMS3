import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '@/constants';

/** Central strings for the archived-template delete dialog — edit here only. */
export const templateDeleteDialogLabels = {
  menuItem: 'Delete permanently',
  title: 'Delete template permanently?',
  cancel: 'Cancel',
  confirm: 'Delete permanently',
  loadingReferences: `Loading ${NOTEBOOK_NAME_CAPITALIZED} references…`,
  loadError: 'Could not load reference count. Try again or contact support.',
} as const;

/**
 * Body copy and layout hints from the number of surveys still linked to the template.
 */
export function getTemplateDeleteDialogBody({
  templateName,
  referencingSurveyCount,
}: {
  templateName: string;
  referencingSurveyCount: number;
}): {
  /** When true, show a prominent warning panel (destructive). */
  showStrongWarning: boolean;
  /** Text before the highlighted template name. */
  introBefore: string;
  /** Shown in monospace / pill styling between introBefore and introAfter. */
  nameLabel: string;
  /** Text after the highlighted name (starts with punctuation if needed). */
  introAfter: string;
  bullets: string[];
  footerNote: string;
} {
  const nameLabel = templateName.trim() || 'this template';

  if (referencingSurveyCount === 0) {
    return {
      showStrongWarning: false,
      introBefore: 'You are about to permanently delete ',
      nameLabel,
      introAfter: '. This cannot be undone.',
      bullets: [
        'The template definition will be removed from the system.',
        `No ${NOTEBOOK_NAME_CAPITALIZED.toLowerCase()}s reference this template, so nothing else will be changed.`,
      ],
      footerNote:
        'If you might need this template again, restore it from the archive instead of deleting.',
    };
  }

  const countLabel =
    referencingSurveyCount === 1
      ? `1 ${NOTEBOOK_NAME_CAPITALIZED}`
      : `${referencingSurveyCount} ${NOTEBOOK_NAME_CAPITALIZED}s`;

  return {
    showStrongWarning: true,
    introBefore: 'You are about to permanently delete ',
    nameLabel,
    introAfter: '. This cannot be undone.',
    bullets: [
      `${countLabel} still reference this template. Those references will be removed from the ${NOTEBOOK_NAME} records.`,
      `${NOTEBOOK_NAME_CAPITALIZED} data (records, attachments) is not deleted, but the link to this template will be cleared.`,
    ],
    footerNote: 'This action is irreversible.',
  };
}
