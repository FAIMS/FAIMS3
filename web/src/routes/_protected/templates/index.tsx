import {createFileRoute, useNavigate} from '@tanstack/react-router';
import type {ColumnDef} from '@tanstack/react-table';
import {DataTable} from '@/components/data-table/data-table';
import {getTemplatesTableColumns} from '@/components/tables/templates';
import {useAuth} from '@/context/auth-provider';
import {useGetTemplates} from '@/hooks/queries';
import {CreateTemplateDialog} from '@/components/dialogs/create-template-dialog';
import {useBreadcrumbUpdate} from '@/hooks/use-breadcrumbs';
import {useMemo, useState} from 'react';
import {
  filterTemplatesByVisibility,
  PUBLIC_TEMPLATE_ROW_CLASS,
  TemplateVisibilityFilterSelect,
  type TemplateVisibilityFilterValue,
} from '@/components/tables/template-visibility-filter';
import {
  Action,
  globalRolesGrantAction,
  type GetListTemplatesResponse,
} from '@faims3/data-model';

type TemplateListRow = GetListTemplatesResponse['templates'][number];

export const Route = createFileRoute('/_protected/templates/')({
  component: RouteComponent,
});

/**
 * RouteComponent component renders the templates page.
 * It displays a table with the user's templates.
 *
 * @returns {JSX.Element} The rendered RouteComponent component.
 */
function RouteComponent() {
  const {user} = useAuth();
  const {isPending, data} = useGetTemplates({user});
  const navigate = useNavigate();
  const [visibilityFilter, setVisibilityFilter] =
    useState<TemplateVisibilityFilterValue>('all');

  // breadcrumbs addition
  const paths = useMemo(
    () => [
      // projects ->
      {
        path: '/templates',
        label: 'Templates',
      },
    ],
    []
  );

  useBreadcrumbUpdate({
    isLoading: false,
    paths,
  });

  const columns = useMemo(
    () =>
      getTemplatesTableColumns({
        includeVisibility: globalRolesGrantAction(
          user?.decodedToken ?? {
            globalRoles: [],
            resourceRoles: [],
          },
          Action.CHANGE_TEMPLATE_VISIBILITY
        ),
      }),
    [user?.decodedToken]
  );

  const filteredTemplates = useMemo(
    () => filterTemplatesByVisibility(data, visibilityFilter),
    [data, visibilityFilter]
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
      {/* CreateTemplateDialog returns null when the user lacks create permission */}
      <DataTable
        columns={columns as ColumnDef<TemplateListRow, unknown>[]}
        data={filteredTemplates}
        loading={isPending}
        initialSorting={[{id: 'createdAt', desc: true}]}
        toolbarExtra={
          <TemplateVisibilityFilterSelect
            value={visibilityFilter}
            onValueChange={setVisibilityFilter}
          />
        }
        getRowClassName={(row: TemplateListRow) =>
          row.isPublic === true ? PUBLIC_TEMPLATE_ROW_CLASS : undefined
        }
        onRowClick={({_id}) => navigate({to: `/templates/${_id}`})}
        button={<CreateTemplateDialog />}
      />
    </div>
  );
}
