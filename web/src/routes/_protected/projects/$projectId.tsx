import { createFileRoute } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ProjectDetails from '@/components/tabs/project/details'
import ProjectInvites from '@/components/tabs/project/invites'
import ProjectUsers from '@/components/tabs/project/users'
import ProjectExport from '@/components/tabs/project/export'
import ProjectActions from '@/components/tabs/project/actions'

const tabs = [
  { name: 'Details', Component: ProjectDetails },
  { name: 'Invites', Component: ProjectInvites },
  { name: 'Users', Component: ProjectUsers },
  { name: 'Export', Component: ProjectExport },
  { name: 'Actions', Component: ProjectActions },
]

/**
 * Route component renders the project details page.
 * It displays the project details, invites, users, export, and actions.
 *
 * @returns {JSX.Element} The rendered Route component.
 */
export const Route = createFileRoute('/_protected/projects/$projectId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { projectId } = Route.useParams()

  return (
    <Tabs defaultValue={tabs[0].name}>
      <TabsList>
        {tabs.map(({ name }) => (
          <TabsTrigger key={name} value={name}>
            {name}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map(({ name, Component }) => (
        <TabsContent key={name} value={name}>
          <Component projectId={projectId} />
        </TabsContent>
      ))}
    </Tabs>
  )
}
