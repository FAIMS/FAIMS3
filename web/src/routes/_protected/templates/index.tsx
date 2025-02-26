import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { DataTable } from '@/components/data-table/data-table'
import { columns } from '@/components/tables/templates'
import { useAuth } from '@/context/auth-provider'
import { useGetTemplates } from '@/hooks/get-hooks'

export const Route = createFileRoute('/_protected/templates/')({
  component: RouteComponent,
})

/**
 * RouteComponent component renders the templates page.
 * It displays a table with the user's templates.
 *
 * @returns {JSX.Element} The rendered RouteComponent component.
 */
function RouteComponent() {
  const { user } = useAuth()

  const { isPending, data } = useGetTemplates(user)

  const navigate = useNavigate()

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={isPending}
      onRowClick={({ _id }) => navigate({ to: `/templates/${_id}` })}
    />
  )
}
