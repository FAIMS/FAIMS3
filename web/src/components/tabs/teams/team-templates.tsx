// SPDX-License-Identifier: Apache-2.0
import {DataTable} from '@/components/data-table/data-table';
import type {ColumnDef} from '@tanstack/react-table';
import {CreateTemplateDialog} from '@/components/dialogs/create-template-dialog';
import {getTemplatesTableColumns} from '@/components/tables/templates';
import {useIsAuthorisedTo, useRequiredUser} from '@/hooks/auth-hooks';
import {useGetTeam, usePagedTemplates} from '@/hooks/queries';
import {
  Action,
  globalRolesGrantAction,
  type GetListTemplatesResponse,
} from '@faims3/data-model';
import {useNavigate} from '@tanstack/react-router';
import {useMemo, useState} from 'react';
import {
  PUBLIC_TEMPLATE_ROW_CLASS,
  TemplateVisibilityFilterSelect,
  type TemplateVisibilityFilterValue,
} from '@/components/tables/template-visibility-filter';

type TemplateListRow = GetListTemplatesResponse['templates'][number];

const TeamTemplates = ({teamId}: {teamId: string}) => {
  const user = useRequiredUser();
  const [visibilityFilter, setVisibilityFilter] =
    useState<TemplateVisibilityFilterValue>('all');
  const {tableLoading, templates, pageSize, serverPagination, serverSearch} =
    usePagedTemplates({
      user,
      teamId,
      visibility: visibilityFilter === 'all' ? undefined : visibilityFilter,
    });
  const {data: team} = useGetTeam({user, teamId});
  const archived = team?.archived === true;

  // can the user see the add button?
  const canAddTemplateInTeam = useIsAuthorisedTo({
    action: Action.CREATE_TEMPLATE_IN_TEAM,
    // resource is the team
    resourceId: teamId,
  });

  const navigate = useNavigate();

  const columns = useMemo(
    () =>
      getTemplatesTableColumns({
        hideTeamColumn: true,
        includeVisibility: globalRolesGrantAction(
          user.decodedToken ?? {
            globalRoles: [],
            resourceRoles: [],
          },
          Action.CHANGE_TEMPLATE_VISIBILITY
        ),
      }),
    [user.decodedToken]
  );

  return (
    <DataTable
      columns={columns as ColumnDef<TemplateListRow, unknown>[]}
      data={templates}
      loading={tableLoading}
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
      button={
        canAddTemplateInTeam &&
        !archived && <CreateTemplateDialog specifiedTeam={teamId} />
      }
      defaultRowsPerPage={pageSize}
      serverPagination={serverPagination}
      serverSearch={serverSearch}
    />
  );
};

export default TeamTemplates;
