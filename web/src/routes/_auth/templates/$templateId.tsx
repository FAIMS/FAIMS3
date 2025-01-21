import {createFileRoute} from '@tanstack/react-router';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import TemplateDetails from '@/components/tabs/templates/template-details';
import TemplateSurveys from '@/components/tabs/templates/template-surveys';
import TemplateActions from '@/components/tabs/templates/template-actions';

const tabs = [
  {
    name: 'Details',
    Component: TemplateDetails,
  },
  {
    name: 'Surveys',
    Component: TemplateSurveys,
  },
  {
    name: 'Actions',
    Component: TemplateActions,
  },
];

export const Route = createFileRoute('/_auth/templates/$templateId')({
  component: RouteComponent,
});

function RouteComponent() {
  const {templateId} = Route.useParams();

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
          <Component templateId={templateId} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
