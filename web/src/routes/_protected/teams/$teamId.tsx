// SPDX-License-Identifier: Apache-2.0
import {ArchiveTeamDialog} from '@/components/dialogs/archive-team-dialog';
import {UpdateTeamDialog} from '@/components/dialogs/teams/update-team-dialog';
import TeamDetails from '@/components/tabs/teams/team-details';
import TeamInvites from '@/components/tabs/teams/team-invites';
import TeamMapLayers from '@/components/tabs/teams/team-map-layers';
import TeamProjects from '@/components/tabs/teams/team-projects';
import TeamTemplates from '@/components/tabs/teams/team-templates';
import TeamUsers from '@/components/tabs/teams/team-users';
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {config} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {useGetTeam} from '@/hooks/queries';
import {useBreadcrumbUpdate} from '@/hooks/use-breadcrumbs';
import {Action} from '@faims3/data-model';
import {createFileRoute, Link, useRouter} from '@tanstack/react-router';
import {Edit} from 'lucide-react';
import {useMemo, useState} from 'react';

type TabLabel =
  | 'Details'
  | 'Invites'
  | 'Projects'
  | 'Map layers'
  | 'Templates'
  | 'Users';

export const Route = createFileRoute('/_protected/teams/$teamId')({
  component: RouteComponent,
});

function RouteComponent() {
  const {teamId} = Route.useParams();
  const {user} = useAuth();
  const {data: team, isLoading} = useGetTeam({user, teamId});
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
  const canChangeTeamStatus = useIsAuthorisedTo({
    action: Action.CHANGE_TEAM_STATUS,
    resourceId: teamId,
  });
  const teamIsArchived = team?.archived === true;

  const tabs: {
    label?: string;
    id: TabLabel;
    Component: any;
    testId?: string;
  }[] = [];

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
      label: config.notebookNamePluralCapitalized,
      Component: TeamProjects,
    });
  }
  if (canSeeTeamDetails) {
    tabs.push({
      id: 'Map layers',
      Component: TeamMapLayers,
      testId: 'web-team-tab-map-layers',
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
    <>
      {!isLoading && teamIsArchived ? (
        <Alert variant="warning" className="mb-6" role="status">
          <AlertTitle>This team is archived</AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p>
              It is hidden from active team lists and cannot be used for new
              membership, invites, or in-team {config.notebookNamePlural},
              templates, or map layers until you restore it from the Archive.
              Existing {config.notebookNamePlural} stay usable.
            </p>
            <p>
              <Link
                to="/archive"
                search={{tab: 'teams'}}
                className="font-medium underline underline-offset-4 hover:text-primary"
              >
                Open Teams in Archive
              </Link>
            </p>
          </AlertDescription>
        </Alert>
      ) : null}
      <Tabs
        defaultValue={tabs[0].id}
        onValueChange={tab => {
          setActiveTab(tab as TabLabel);
        }}
      >
        <div className="flex justify-start items-center gap-4">
          <TabsList>
            {tabs.map(({id, label, testId}) => (
              <TabsTrigger key={id} value={id} data-testid={testId}>
                {label ?? id}
              </TabsTrigger>
            ))}
          </TabsList>

          {activeTab === 'Details' && canEditTeamDetails && !teamIsArchived && (
            <UpdateTeamDialog
              teamId={teamId}
              buttonContent={
                <>
                  Edit <Edit size={18} />
                </>
              }
            ></UpdateTeamDialog>
          )}
          {activeTab === 'Details' && canChangeTeamStatus && (
            <ArchiveTeamDialog archived={teamIsArchived} />
          )}
        </div>

        {tabs.map(({id, Component}) => (
          <TabsContent key={id} value={id}>
            <Component teamId={teamId} />
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
