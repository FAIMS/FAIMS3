import {UpdateTeamDialog} from '@/components/dialogs/teams/update-team-dialog';
import TeamDetails from '@/components/tabs/teams/team-details';
import TeamInvites from '@/components/tabs/teams/team-invites';
import TeamProjects from '@/components/tabs/teams/team-projects';
import TeamTemplates from '@/components/tabs/teams/team-templates';
import TeamUsers from '@/components/tabs/teams/team-users';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {useGetTeam} from '@/hooks/queries';
import {useBreadcrumbUpdate} from '@/hooks/use-breadcrumbs';
import {Action} from '@faims3/data-model';
import {createFileRoute, useRouter} from '@tanstack/react-router';
import {Edit} from 'lucide-react';
import {useMemo, useState} from 'react';

type TabLabel = 'Details' | 'Invites' | 'Projects' | 'Templates' | 'Users';

export const Route = createFileRoute('/_protected/teams/$teamId')({
  component: RouteComponent,
});

function RouteComponent() {
  const {teamId} = Route.useParams();
  const {user} = useAuth();
  const {data: team, isLoading} = useGetTeam(user, teamId);
  const pathname = useRouter().state.location.pathname;

  // breadcrumbs addition
  const paths = useMemo(
    () => [
      // projects ->
      {
        path: '/teams',
        label: 'Teams',
      },
      // project name
      {
        path: pathname,
        label: team?.name ?? teamId,
      },
    ],
    [pathname, team]
  );

  useBreadcrumbUpdate({
    isLoading,
    paths,
  });

  // Access checks
  const canSeeTeamDetails = useIsAuthorisedTo({
    action: Action.VIEW_TEAM_DETAILS,
    resourceId: teamId,
  });
  const canSeeTeamInvites = useIsAuthorisedTo({
    action: Action.VIEW_TEAM_INVITES,
    resourceId: teamId,
  });
  const canEditTeamDetails = useIsAuthorisedTo({
    action: Action.UPDATE_TEAM_DETAILS,
    resourceId: teamId,
  });
  const canViewTeamMembers = useIsAuthorisedTo({
    action: Action.VIEW_TEAM_MEMBERS,
    resourceId: teamId,
  });
  const canViewTeamProjects = useIsAuthorisedTo({
    action: Action.LIST_PROJECTS,
    resourceId: teamId,
  });
  const canViewTeamTemplates = useIsAuthorisedTo({
    action: Action.LIST_TEMPLATES,
    resourceId: teamId,
  });

  const tabs: {label?: string; id: TabLabel; Component: any}[] = [];

  // details?
  if (canSeeTeamDetails) {
    tabs.push({id: 'Details', Component: TeamDetails});
  }
  if (canSeeTeamInvites) {
    tabs.push({id: 'Invites', Component: TeamInvites});
  }
  if (canViewTeamProjects) {
    tabs.push({
      id: 'Projects',
      label: NOTEBOOK_NAME_CAPITALIZED + 's',
      Component: TeamProjects,
    });
  }
  if (canViewTeamTemplates) {
    tabs.push({id: 'Templates', Component: TeamTemplates});
  }
  // members?
  if (canViewTeamMembers) {
    tabs.push({id: 'Users', Component: TeamUsers});
  }

  const [activeTab, setActiveTab] = useState<TabLabel>(tabs[0].id);

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

        {activeTab === 'Details' && canEditTeamDetails && (
          <UpdateTeamDialog
            teamId={teamId}
            buttonContent={
              <>
                Edit <Edit size={18} />
              </>
            }
          ></UpdateTeamDialog>
        )}
      </div>

      {tabs.map(({id, Component}) => (
        <TabsContent key={id} value={id}>
          <Component teamId={teamId} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
