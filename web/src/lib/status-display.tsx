import type {ReactNode} from 'react';
import {ProjectStatus} from '@faims3/data-model';

/**
 * Renders a small coloured indicator and label for a project (notebook) status.
 *
 * Shared between the project details and team details views so the status badge
 * looks the same everywhere a project status is shown.
 */
export const statusDisplay = (status: ProjectStatus | undefined): ReactNode => {
  if (status === ProjectStatus.OPEN) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="text-sm text-card-foreground">Open</span>
      </div>
    );
  }
  if (status === ProjectStatus.CLOSED) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-muted-foreground" />
        <span className="text-sm text-muted-foreground">Closed</span>
      </div>
    );
  }
  if (status === ProjectStatus.ARCHIVED) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-amber-600/80" />
        <span className="text-sm text-muted-foreground">Archived</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-2 rounded-full bg-gray-300" />
      <span className="text-sm text-muted-foreground">Unknown</span>
    </div>
  );
};
