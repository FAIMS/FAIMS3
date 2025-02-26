import {Link, useLocation} from '@tanstack/react-router';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './ui/breadcrumb';
import {capitalize} from '@/lib/utils';
import {useAuth, User} from '@/context/auth-provider';
import {Fragment} from 'react';
import {useGetProjects, useGetTemplates} from '@/hooks/get-hooks';
import {Skeleton} from './ui/skeleton';

/**
 * useGetData function fetches data for a given path.
 *
 * @param {User} user - The user object.
 * @param {string[]} pathname - The pathname array.
 * @returns {Promise<Data>} The data for the path.
 */
const useGetData = (user: User | null, pathname: string[]) => {
  if (pathname.length < 2) return {data: null, isPending: false};

  if (pathname[0] === 'projects') return useGetProjects(user, pathname[1]);
  if (pathname[0] === 'templates') return useGetTemplates(user, pathname[1]);

  return {data: null, isPending: false};
};

/**
 * breadcrumbWithHook function renders a breadcrumb with a hook.
 * It displays the name of the breadcrumb based on the data and loading state.
 *
 * @param {string} name - The name of the breadcrumb.
 * @param {any} data - The data for the breadcrumb.
 * @param {boolean} isPending - The loading state of the breadcrumb.
 * @returns {JSX.Element} The rendered breadcrumb with hook.
 */
const breadcrumbWithHook = (name: string, data: any, isPending: boolean) => {
  if (isPending) return <Skeleton className="w-full h-4 rounded-full" />;

  return <div>{data?.metadata?.name || data?.template_name || name}</div>;
};

/**
 * Breadcrumbs component renders a breadcrumb navigation for the current page.
 * It displays the current page's path as a list of breadcrumb items.
 *
 * @returns {JSX.Element} The rendered Breadcrumbs component.
 */
export default function Breadcrumbs() {
  const pathname = useLocation({
    select: location => location.pathname,
  })
    .split('/')
    .slice(1);

  const {user} = useAuth();
  const {data, isPending} = useGetData(user, pathname);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {pathname.map((path, index) => (
          <Fragment key={path}>
            {index > 0 && <BreadcrumbSeparator />}
            {index < pathname.length - 1 ? (
              <BreadcrumbItem className="hidden md:block">
                <Link to={pathname.slice(0, index + 1).join('/')}>
                  {index === 1 && breadcrumbWithHook(path, data, isPending)}
                  {index !== 1 && capitalize(path)}
                </Link>
              </BreadcrumbItem>
            ) : (
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {index === 1 && breadcrumbWithHook(path, data, isPending)}
                  {index !== 1 && capitalize(path)}
                </BreadcrumbPage>
              </BreadcrumbItem>
            )}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
