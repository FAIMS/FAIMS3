import {createFileRoute, useRouter} from '@tanstack/react-router';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import TemplateDetails from '@/components/tabs/templates/details';
import TemplateProjects from '@/components/tabs/templates/projects';
import TemplateActions from '@/components/tabs/templates/actions';
import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {useGetTemplate} from '@/hooks/queries';
import {useAuth} from '@/context/auth-provider';
import {useBreadcrumbUpdate} from '@/hooks/use-breadcrumbs';
import {useMemo} from 'react';

const tabs = [
  {
    name: 'Details',
    Component: TemplateDetails,
  },
  {
    name: `${NOTEBOOK_NAME_CAPITALIZED}s`,
    Component: TemplateProjects,
  },
  {
    name: 'Actions',
    Component: TemplateActions,
  },
];

/**
 * Route component renders the template details page.
 * It displays the template details, surveys, and actions.
 *
 * @returns {JSX.Element} The rendered Route component.
 */
export const Route = createFileRoute('/_protected/templates/$templateId')({
  component: RouteComponent,
});

function RouteComponent() {
  const {templateId} = Route.useParams();
  const {user} = useAuth();
  const {data: template, isLoading} = useGetTemplate(user, templateId);
  const pathname = useRouter().state.location.pathname;

  // breadcrumbs addition
  const paths = useMemo(
    () => [
      // projects ->
      {
        path: '/templates',
        label: 'Templates',
      },
      // project name
      {
        path: pathname,
        label: template?.name ?? templateId,
      },
    ],
    [pathname, template]
  );

  useBreadcrumbUpdate({
    isLoading,
    paths,
  });

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
