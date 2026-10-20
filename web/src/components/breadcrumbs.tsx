// SPDX-License-Identifier: Apache-2.0
import React from 'react';
import {Link, useRouter} from '@tanstack/react-router';
import {ChevronRight} from 'lucide-react';
import {useBreadcrumb} from '../context/breadcrumb-provider';
import {Skeleton} from './ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

/** Shorter than table cells so a long resource name cannot widen the header. */
const BREADCRUMB_LABEL_MAX_LENGTH = 24;

/** Truncate a long crumb and show the full name in a tooltip. */
function BreadcrumbLabel({label}: {label: string}) {
  const isTruncated = label.length > BREADCRUMB_LABEL_MAX_LENGTH;
  const display = isTruncated
    ? `${label.slice(0, BREADCRUMB_LABEL_MAX_LENGTH)}…`
    : label;

  if (!isTruncated) {
    return <>{display}</>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help">{display}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">
        <p className="break-words">{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function Breadcrumbs() {
  const router = useRouter();
  const {breadcrumbs} = useBreadcrumb();

  // Get current route path parts
  const currentPath = router.state.location.pathname;
  const pathParts = currentPath.split('/').filter(Boolean);

  // Build up all possible parent paths
  const routePaths = pathParts.map((_, index) => {
    return '/' + pathParts.slice(0, index + 1).join('/');
  });

  // Add home route
  if (currentPath !== '/') {
    routePaths.unshift('/');
  }

  return (
    <TooltipProvider>
      <nav className="flex min-w-0 items-center space-x-1 text-sm">
        {routePaths.map((path, index) => {
          // Get custom breadcrumb info if available
          const crumbInfo = breadcrumbs[path];

          // Default label is the path segment itself or "Home" for root
          const defaultLabel =
            path === '/' ? 'Home' : pathParts[index - 1] || pathParts[index];

          const label = crumbInfo?.label || defaultLabel;
          const isLoading = crumbInfo?.isLoading;

          const isLast = index === routePaths.length - 1;

          return (
            <React.Fragment key={path}>
              {index > 0 && (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}

              <div className="flex min-w-0 items-center">
                {isLoading ? (
                  <Skeleton className="h-4 w-20" />
                ) : (
                  <Link
                    to={path}
                    className={`hover:text-foreground ${
                      isLast
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground'
                    }`}
                    aria-current={isLast ? 'page' : undefined}
                  >
                    <BreadcrumbLabel label={label} />
                  </Link>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}
