import {UpdateTeamDialog} from '@/components/dialogs/update-team-dialog';
import TeamDetails from '@/components/tabs/teams/details';
import {Button} from '@/components/ui/button';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {createFileRoute} from '@tanstack/react-router';
import {useState} from 'react';

const tabs = [
  // TODO
  {name: 'Details', Component: TeamDetails},
];

/**
 * Route component renders the project details page.
 * It displays the project details, invites, users, export, and actions.
 *
 * @returns {JSX.Element} The rendered Route component.
 */
export const Route = createFileRoute('/_protected/teams/$teamId')({
  component: RouteComponent,
});

function RouteComponent() {
  const {teamId} = Route.useParams();

  return (
    <Tabs defaultValue={tabs[0].name}>
      <div>
        <TabsList>
          {tabs.map(({name}) => (
            <TabsTrigger key={name} value={name}>
              {name}
            </TabsTrigger>
          ))}
        </TabsList>
        <UpdateTeamDialog teamId={teamId} />
      </div>
      {tabs.map(({name, Component}) => (
        <TabsContent key={name} value={name}>
          <Component teamId={teamId} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
