// SPDX-License-Identifier: Apache-2.0

import {Badge} from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Actions-tab chip when this device has an unpublished designer draft.
 */
export function DesignerUnsavedDraftIndicator({
  visible,
  stale = false,
}: {
  visible: boolean;
  stale?: boolean;
}) {
  if (!visible) {
    return null;
  }

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
              {stale
                ? 'Unsaved changes — live design has changed'
                : 'Unsaved changes'}
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <p>
            {stale
              ? 'This device has an unpublished local draft based on an older live design. Open in Editor to continue, or discard the draft and load the live design.'
              : 'This device has an unpublished local draft. Open in Editor to continue or publish.'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
