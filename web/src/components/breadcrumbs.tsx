import {Link, useLocation} from '@tanstack/react-router';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './ui/breadcrumb';
import {capitalize} from '@/lib/utils';
import {Fragment} from 'react';
import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';

/**
 * breadcrumbMap function maps a path to a breadcrumb name.
 * It handles the special case of the projects page.
 *
 * @param {string} name - The name of the path.
 * @param {number} index - The index of the path in the pathname array.
 * @returns {string} The mapped breadcrumb name.
 */
const breadcrumbMap = (name: string, index: number) => {
  if (index === 0) {
    if (name === 'projects') return `${NOTEBOOK_NAME_CAPITALIZED}s`;

    return capitalize(name);
  }

  return name;
};

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

  if (pathname.length === 0) return <></>;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {pathname.map((path, index) => (
          <Fragment key={path}>
            {index > 0 && <BreadcrumbSeparator />}
            {index < pathname.length - 1 ? (
              <BreadcrumbItem className="hidden md:block">
                <Link to={pathname.slice(0, index + 1).join('/')}>
                  {breadcrumbMap(path, index)}
                </Link>
              </BreadcrumbItem>
            ) : (
              <BreadcrumbItem>
                <BreadcrumbPage>{breadcrumbMap(path, index)}</BreadcrumbPage>
              </BreadcrumbItem>
            )}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
