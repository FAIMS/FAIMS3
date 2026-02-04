import GlobalInvites from '@/components/tabs/admin/global-invites';
import {UsersTab} from '@/components/tabs/admin/users';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {useBreadcrumbUpdate} from '@/hooks/use-breadcrumbs';
import {Action} from '@faims3/data-model';
import {createFileRoute} from '@tanstack/react-router';
import {useMemo, useState} from 'react';

type TabLabel = 'Users' | 'Global Invites';

export const Route = createFileRoute('/_protected/_admin/users')({
  component: RouteComponent,
});

function RouteComponent() {
  // breadcrumbs addition
  const paths = useMemo(
    () => [
      // projects ->
      {
        path: '/users',
        label: 'Users',
      },
    ],
    []
  );

  useBreadcrumbUpdate({
    isLoading: false,
    paths,
  });

  // Access checks
  const canSeeGlobalInvites = useIsAuthorisedTo({
    action: Action.VIEW_GLOBAL_INVITES,
  });
  const canSeeUsers = useIsAuthorisedTo({
    action: Action.VIEW_USER_LIST,
  });

  if (!canSeeGlobalInvites && !canSeeUsers) {
    return <p>You do not have access to view this page.</p>;
  }

  const tabs: {label?: string; id: TabLabel; Component: any}[] = [];

  if (canSeeUsers) {
    tabs.push({id: 'Users', Component: UsersTab});
  }

  // details?
  if (canSeeGlobalInvites) {
    tabs.push({id: 'Global Invites', Component: GlobalInvites});
  }

  const [, setActiveTab] = useState<TabLabel>(tabs[0].id);

  return (
    <Tabs
      defaultValue={tabs[0].id}
      onValueChange={tab => {
        setActiveTab(tab as TabLabel);
      }}
    >
      <div className="flex justify-start items-center gap-4">
        <TabsList>
          {tabs.map(({id, label}) => (
            <TabsTrigger key={id} value={id}>
              {label ?? id}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {tabs.map(({id, Component}) => (
        <TabsContent key={id} value={id}>
          <Component />
        </TabsContent>
      ))}
    </Tabs>
  );
}
