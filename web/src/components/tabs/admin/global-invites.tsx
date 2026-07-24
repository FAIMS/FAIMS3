import {DataTable} from '@/components/data-table/data-table';
import {CreateGlobalInvite} from '@/components/dialogs/create-global-invite';
import {useGetGlobalInviteColumns} from '@/components/tables/global-invites';
import {config} from '@/constants';
import {useIsAuthorisedTo, useRequiredUser} from '@/hooks/auth-hooks';
import {useGetGlobalInvites} from '@/hooks/queries';
import {removeGlobalInvite} from '@/hooks/global-hooks';
import {Action} from '@faims3/data-model';

/**
 * GlobalInvites component renders a table of global invites.
 * It displays the invite details such as email and role.
 *
 * @returns {JSX.Element} The rendered GlobalInvites component.
 */
const GlobalInvites = () => {
  const user = useRequiredUser();

  const {data, isLoading} = useGetGlobalInvites({
    user,
    redirect: `${config.webUrl}`,
  });

  const columns = useGetGlobalInviteColumns({
    deleteInviteHandler: async (inviteId: string) => {
      return await removeGlobalInvite({inviteId, user});
    },
  });

  // can we create this invite?
  const canCreateGlobalInvite = useIsAuthorisedTo({
    action: Action.CREATE_GLOBAL_INVITE,
  });

  return (
    <DataTable
      columns={columns}
      data={data || []}
      loading={isLoading}
      button={canCreateGlobalInvite && <CreateGlobalInvite />}
    />
  );
};

export default GlobalInvites;
