import {ChevronRight, type LucideIcon} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import {Link, useLocation, useRouterState} from '@tanstack/react-router';
import {cn} from '@/lib/utils';

export interface NavItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  /** Optional search params for the primary nav link (e.g. Archive default tab). */
  linkSearch?: Record<string, string>;
  items?: {
    id: string;
    title: string;
    url?: string;
    search?: Record<string, string>;
  }[];
}

interface NavMainProps {
  title: string;
  items: NavItem[];
}

/**
 * Main navigation component that renders a sidebar with collapsible menu items.
 *
 * @param {NavMainProps} props - The properties object.
 * @param {string} props.title - The title of the navigation group.
 * @param {NavItem[]} props.items - The navigation items to display.
 * @returns {JSX.Element} The rendered navigation component.
 */
function subItemIsActive(
  pathname: string,
  locationSearch: Record<string, unknown>,
  subItem: NonNullable<NavItem['items']>[number]
) {
  if (!subItem.url) return false;
  if (subItem.search) {
    if (pathname !== subItem.url) return false;
    for (const [k, expected] of Object.entries(subItem.search)) {
      if (String(locationSearch[k] ?? '') !== expected) return false;
    }
    return true;
  }
  return pathname.startsWith(subItem.url);
}

export function NavMain({title, items}: NavMainProps) {
  const {pathname} = useLocation();
  const locationSearch = useRouterState({
    select: s => {
      const raw = s.location.search;
      if (raw && typeof raw === 'object') {
        return raw as Record<string, unknown>;
      }
      if (typeof raw === 'string' && raw.length > 0) {
        const qs = raw.startsWith('?') ? raw.slice(1) : raw;
        return Object.fromEntries(new URLSearchParams(qs)) as Record<
          string,
          unknown
        >;
      }
      return {};
    },
  });

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map(item => {
          const isActive = item.isActive ?? pathname.startsWith(item.url);
          return (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={isActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                {item.items ? (
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <Link
                        to={item.url}
                        {...(item.linkSearch ? {search: item.linkSearch} : {})}
                        className={cn(
                          'flex items-center gap-2',
                          isActive && 'bg-sidebar-accent'
                        )}
                      >
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </Link>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                ) : (
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <Link
                      to={item.url}
                      {...(item.linkSearch ? {search: item.linkSearch} : {})}
                      className="flex items-center gap-2"
                    >
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                )}
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map(subItem => (
                      <SidebarMenuSubItem key={subItem.id}>
                        <SidebarMenuSubButton asChild>
                          {subItem.url ? (
                            <Link
                              to={subItem.url}
                              {...(subItem.search
                                ? {search: subItem.search}
                                : {})}
                              className={
                                subItemIsActive(
                                  pathname,
                                  locationSearch,
                                  subItem
                                )
                                  ? 'bg-sidebar-accent'
                                  : ''
                              }
                            >
                              <span className="text-muted-foreground">
                                {subItem.title}
                              </span>
                            </Link>
                          ) : (
                            <div className={'cursor-default'}>
                              <span className="text-muted-foreground">
                                {subItem.title}
                              </span>
                            </div>
                          )}
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
