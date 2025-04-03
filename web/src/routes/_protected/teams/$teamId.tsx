import {UpdateTeamDialog} from '@/components/dialogs/teams/update-team-dialog';
import TeamDetails from '@/components/tabs/teams/team-details';
import TeamProjects from '@/components/tabs/teams/team-projects';
import TeamTemplates from '@/components/tabs/teams/team-templates';
import TeamUsers from '@/components/tabs/teams/team-users';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {createFileRoute} from '@tanstack/react-router';
import {Edit} from 'lucide-react';

const tabs = [
  {name: 'Details', Component: TeamDetails},
  {name: 'Surveys', Component: TeamProjects},
  {name: 'Templates', Component: TeamTemplates},
  {name: 'Users', Component: TeamUsers},
];

export const Route = createFileRoute('/_protected/teams/$teamId')({
  component: RouteComponent,
});

function RouteComponent() {
  const {teamId} = Route.useParams();
  return (
    <Tabs defaultValue={tabs[0].name}>
      <div className="flex justify-start items-center gap-4">
        <TabsList>
          {tabs.map(({name}) => (
            <TabsTrigger key={name} value={name}>
              {name}
            </TabsTrigger>
          ))}
        </TabsList>
        <UpdateTeamDialog
          teamId={teamId}
          buttonContent={
            <>
              Edit <Edit size={18} />
            </>
          }
        ></UpdateTeamDialog>
      </div>
      {tabs.map(({name, Component}) => (
        <TabsContent key={name} value={name}>
          <Component teamId={teamId} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
