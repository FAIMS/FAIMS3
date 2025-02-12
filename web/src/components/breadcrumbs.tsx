import {Link, useLocation} from '@tanstack/react-router';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './ui/breadcrumb';
import {capitalize} from '@/lib/utils';
import {useAuth} from '@/context/auth-provider';
import {Fragment} from 'react';

/**
 * Breadcrumbs component renders a breadcrumb navigation for the current page.
 * It displays the current page's path as a list of breadcrumb items.
 *
 * @returns {JSX.Element} The rendered Breadcrumbs component.
 */
export default function Breadcrumbs() {
  const {user} = useAuth();

  if (!user) return <></>;

  const pathname = useLocation({
    select: location => location.pathname,
  }).split('/');

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {pathname.map((path, index) => (
          <Fragment key={path}>
            {index > 1 && <BreadcrumbSeparator />}
            {index < pathname.length - 1 ? (
              <BreadcrumbItem className="hidden md:block">
                <Link to={pathname.slice(0, index + 1).join('/')}>
                  {capitalize(path)}
                </Link>
              </BreadcrumbItem>
            ) : (
              <BreadcrumbItem>
                <BreadcrumbPage>{capitalize(path)}</BreadcrumbPage>
              </BreadcrumbItem>
            )}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
