import {DataTable} from '@/components/data-table/data-table';
import {columns} from '@/components/tables/teams';
import {useAuth} from '@/context/auth-provider';
import {useGetTeams} from '@/hooks/queries';
import {createFileRoute, useNavigate, useRouter} from '@tanstack/react-router';

import {CreateTeamDialog} from '@/components/dialogs/teams/create-team-dialog';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {Action} from '@faims3/data-model';
import {useBreadcrumbUpdate} from '@/hooks/use-breadcrumbs';
import {useMemo} from 'react';

export const Route = createFileRoute('/_protected/teams/')({
  component: RouteComponent,
});

import Bugsnag from '@bugsnag/js';
import {useState} from 'react';

export const BugsnagTest = () => {
  const [throwRender, setThrowRender] = useState(false);

  if (throwRender) {
    throw new Error('Test: React render error');
  }

  return (
    <div style={{padding: '1rem', border: '1px solid #ccc', margin: '1rem'}}>
      <h3>Bugsnag Test Panel</h3>
      <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
        <button onClick={() => setThrowRender(true)}>Render Error</button>
        <button
          onClick={() => {
            throw new Error('Test: Click handler error');
          }}
        >
          Click Error
        </button>
        <button
          onClick={() => {
            Promise.reject(new Error('Test: Promise rejection'));
          }}
        >
          Promise Rejection
        </button>
        <button
          onClick={() => {
            Bugsnag.notify(new Error('Test: Manual notify'));
          }}
        >
          Manual Notify
        </button>
      </div>
    </div>
  );
};

/**
 * RouteComponent component renders the projects page.
 * It displays a table with the user's projects.
 *
 * @returns {JSX.Element} The rendered RouteComponent component.
 */
export function RouteComponent() {
  const {user} = useAuth();
  const pathname = useRouter().state.location.pathname;

  // breadcrumbs addition
  const paths = useMemo(
    () => [
      // projects ->
      {
        path: '/teams',
        label: 'Teams',
      },
    ],
    [pathname]
  );

  useBreadcrumbUpdate({
    isLoading: false,
    paths,
  });

  if (!user) {
    return <p>No user!</p>;
  }

  // Can the user create a new team?
  const canCreateTeam = useIsAuthorisedTo({action: Action.CREATE_TEAM});

  const {isPending, data} = useGetTeams({user});

  const navigate = useNavigate();

  return (
    <>
      <DataTable
        columns={columns}
        data={data ? data?.teams : []}
        loading={isPending}
        onRowClick={({_id}) => navigate({to: `/teams/${_id}`})}
        button={canCreateTeam && <CreateTeamDialog />}
      />
      <BugsnagTest />
    </>
  );
}
