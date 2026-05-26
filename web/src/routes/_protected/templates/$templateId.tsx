import {createFileRoute, Link, useRouter} from '@tanstack/react-router';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import TemplateDetails from '@/components/tabs/templates/details';
import TemplateProjects from '@/components/tabs/templates/projects';
import TemplateActions from '@/components/tabs/templates/actions';
import {NOTEBOOK_NAME_PLURAL_CAPITALIZED} from '@/constants';
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
    name: NOTEBOOK_NAME_PLURAL_CAPITALIZED,
    Component: TemplateProjects,
  },
  {
    name: 'Actions',
    Component: TemplateActions,
  },
];

/**
 * Route component renders the template details page.
 * It displays the template details, linked notebooks, and actions.
 *
 * @returns {JSX.Element} The rendered Route component.
 */
export const Route = createFileRoute('/_protected/templates/$templateId')({
  component: RouteComponent,
});

function RouteComponent() {
  const {templateId} = Route.useParams();
  const {user} = useAuth();
  const {data: template, isLoading} = useGetTemplate({user, templateId});
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
    <>
      {!isLoading && template?.archived === true ? (
        <Alert
          className="mb-6 border-amber-500/40 bg-amber-500/10 text-amber-950 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-50 [&>svg]:text-amber-700 dark:[&>svg]:text-amber-300"
          role="status"
        >
          <AlertTitle>This template is archived</AlertTitle>
          <AlertDescription className="mt-2 space-y-2 text-amber-900/90 dark:text-amber-50/90">
            <p>
              It is hidden from active template lists and cannot be used to
              create new {NOTEBOOK_NAME_PLURAL_CAPITALIZED} until you restore it
              from the Archive.
            </p>
            <p>
              <Link
                to="/archive"
                search={{tab: 'templates'}}
                className="font-medium text-amber-950 underline underline-offset-4 hover:text-amber-800 dark:text-amber-50 dark:hover:text-amber-200"
              >
                Open Templates in Archive
              </Link>
            </p>
          </AlertDescription>
        </Alert>
      ) : null}
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
    </>
  );
}
