// SPDX-License-Identifier: Apache-2.0
import {ProjectStatus} from '@faims3/data-model';
import {projectStatusHelpText} from '@/lib/status-display';
import {Badge} from '../ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

export type ProjectStatusDisplay = {
  label: 'Open' | 'Closed' | 'Archived';
  className: string;
  tooltip: string;
};

/** Returns the listing label, theme classes, and informational tooltip. */
export function projectStatusDisplay(
  status: ProjectStatus
): ProjectStatusDisplay {
  switch (status) {
    case ProjectStatus.OPEN:
      return {
        label: 'Open',
        className: 'border-success/40 bg-success/10 text-success',
        tooltip: projectStatusHelpText(status),
      };
    case ProjectStatus.CLOSED:
      return {
        label: 'Closed',
        className: 'border-destructive/40 bg-destructive/10 text-destructive',
        tooltip: projectStatusHelpText(status),
      };
    case ProjectStatus.ARCHIVED:
      return {
        label: 'Archived',
        className: 'border-muted-foreground/40 bg-muted text-muted-foreground',
        tooltip: projectStatusHelpText(status),
      };
  }
}

/** Renders a focusable informational status chip for a survey listing row. */
export function ProjectStatusBadge({status}: {status: ProjectStatus}) {
  const display = projectStatusDisplay(status);

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Native span so Radix can attach hover/focus handlers. */}
          <span
            className="inline-flex w-fit cursor-help"
            tabIndex={0}
            onClick={event => event.stopPropagation()}
          >
            <Badge variant="outline" className={`w-fit ${display.className}`}>
              {display.label}
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <p>{display.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
