// SPDX-License-Identifier: Apache-2.0

import {Badge} from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {config} from '@/constants';

/**
 * Actions-tab chip when this device has an unpublished designer draft.
 */
export function DesignerUnsavedDraftIndicator({
  visible,
  stale = false,
  resourceName = config.notebookName,
  resourceNameCapitalized = config.notebookNameCapitalized,
}: {
  visible: boolean;
  stale?: boolean;
  resourceName?: string;
  resourceNameCapitalized?: string;
}) {
  if (!visible) {
    return null;
  }

  const chipLabel = stale
    ? 'unsafe changes - latest design has changed'
    : 'Unpublished changes';
  const tooltip = stale
    ? `Another user has published a new version of the ${resourceName} while you are working on your draft. 'Edit ${resourceNameCapitalized}' to resolve this conflict.`
    : `This device has an unpublished local draft. 'Edit ${resourceNameCapitalized}' to continue working or publish your changes.`;

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex w-fit cursor-help"
            tabIndex={0}
            data-testid="web-designer-unsaved-changes-indicator"
            data-stale={stale ? 'true' : 'false'}
          >
            <Badge
              variant="outline"
              className="w-fit gap-1.5 font-medium border-notice/40 bg-notice/10 text-notice"
            >
              <span
                className="h-1.5 w-1.5 rounded-full bg-current"
                aria-hidden
              />
              {chipLabel}
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
