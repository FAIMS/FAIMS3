import {Link, useLocation} from '@tanstack/react-router';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from './ui/breadcrumb';
import {useAuth} from '@/context/auth-provider';
import {Fragment} from 'react';
import {useGetProject, useGetTemplate} from '@/hooks/queries';
import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {Skeleton} from './ui/skeleton';

/**
 * Breadcrumbs component renders a breadcrumb navigation for the current page.
 * It displays the current page's path as a list of breadcrumb items.
 *
 * @returns {JSX.Element} The rendered Breadcrumbs component.
 */
export default function Breadcrumbs() {
  const pathname = useLocation({
    select: ({pathname}) => pathname,
  })
    .split('/')
    .slice(1);

  const {user} = useAuth();
  const {data, isLoading} =
    pathname.at(0) === 'projects'
      ? useGetProject(user, pathname.at(1) || '')
      : useGetTemplate(user, pathname.at(1) || '');

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {pathname.map((path, index) => (
          <Fragment key={path}>
            {index > 0 && <BreadcrumbSeparator />}
            {index === 0 && (
              <BreadcrumbItem>
                <Link to={pathname.at(0)}>
                  {pathname.at(0) === 'projects'
                    ? NOTEBOOK_NAME_CAPITALIZED
                    : 'Template'}
                  s
                </Link>
              </BreadcrumbItem>
            )}
            {index === 1 &&
              (isLoading ? (
                <Skeleton className="w-16 h-5 rounded-md" />
              ) : (
                <BreadcrumbItem>
                  {data?.metadata?.name || pathname.at(1)}
                </BreadcrumbItem>
              ))}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
