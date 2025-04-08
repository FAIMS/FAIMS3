import React from 'react';
import {Link, useRouter} from '@tanstack/react-router';
import {ChevronRight} from 'lucide-react';
import {useBreadcrumb} from '../context/breadcrumb-provider';
import {Skeleton} from './ui/skeleton';

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
    <nav className="flex items-center space-x-1 text-sm">
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
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}

            <div className="flex items-center">
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
                  {label}
                </Link>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
