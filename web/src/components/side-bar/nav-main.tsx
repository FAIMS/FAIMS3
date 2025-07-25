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
import {Link, useLocation} from '@tanstack/react-router';
import {cn} from '@/lib/utils';

export interface NavItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  items?: {
    id: string;
    title: string;
    url?: string;
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
export function NavMain({title, items}: NavMainProps) {
  const {pathname} = useLocation();

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
                    <Link to={item.url} className="flex items-center gap-2">
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
                              className={
                                pathname.startsWith(subItem.url)
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
