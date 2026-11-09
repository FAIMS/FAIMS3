// SPDX-License-Identifier: Apache-2.0
import {ProjectStatus} from '@faims3/data-model';
import {config} from '@/constants';
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
        tooltip: `${config.notebookNameCapitalized} is active and available for data collection on user devices.`,
      };
    case ProjectStatus.CLOSED:
      return {
        label: 'Closed',
        className: 'border-destructive/40 bg-destructive/10 text-destructive',
        tooltip: `${config.notebookNameCapitalized} is read-only. Users will not be able to activate this ${config.notebookName} for data collection.`,
      };
    case ProjectStatus.ARCHIVED:
      return {
        label: 'Archived',
        className: 'border-muted-foreground/40 bg-muted text-muted-foreground',
        tooltip: `This ${config.notebookName} is archived and hidden from default lists.`,
      };
  }
}

/** Renders a focusable informational status chip for a survey listing row. */
export function ProjectStatusBadge({status}: {status: ProjectStatus}) {
  const display = projectStatusDisplay(status);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`w-fit cursor-help ${display.className}`}
            tabIndex={0}
          >
            {display.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{display.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
