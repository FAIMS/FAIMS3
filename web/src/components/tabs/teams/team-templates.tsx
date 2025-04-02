import {DataTable} from '@/components/data-table/data-table';
import {CreateTemplateDialog} from '@/components/dialogs/create-template-dialog';
import {columns} from '@/components/tables/templates';
import {useAuth} from '@/context/auth-provider';
import {useGetTemplatesForTeam} from '@/hooks/get-hooks';
import {useNavigate} from '@tanstack/react-router';

const TeamTemplates = ({teamId}: {teamId: string}) => {
  const {user} = useAuth();

  const {isPending, data} = useGetTemplatesForTeam({user, teamId});

  const navigate = useNavigate();

  return (
    <DataTable
      columns={columns}
      data={data?.templates}
      loading={isPending}
      onRowClick={({_id}) => navigate({to: `/templates/${_id}`})}
      button={<CreateTemplateDialog />}
    />
  );
};

export default TeamTemplates;
