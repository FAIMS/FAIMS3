import {createFileRoute} from '@tanstack/react-router';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import SurveyDetails from '@/components/tabs/survey/survey-details';
import SurveyInvites from '@/components/tabs/survey/survey-invites';
import SurveyUsers from '@/components/tabs/survey/survey-users';
import SurveyExport from '@/components/tabs/survey/survey-export';
import SurveyActions from '@/components/tabs/survey/survey-actions';

const tabs = [
  {name: 'Details', Component: SurveyDetails},
  {name: 'Invites', Component: SurveyInvites},
  {name: 'Users', Component: SurveyUsers},
  {name: 'Export', Component: SurveyExport},
  {name: 'Actions', Component: SurveyActions},
];

export const Route = createFileRoute('/_auth/surveys/$surveyId')({
  component: RouteComponent,
});

function RouteComponent() {
  const {surveyId} = Route.useParams();

  return (
    <Tabs defaultValue={tabs[0].name}>
      <TabsList>
        {tabs.map(({name}) => (
          <TabsTrigger key={name} value={name}>
            {name}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map(({name, Component}) => (
        <TabsContent key={name} value={name}>
          <Component surveyId={surveyId} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
