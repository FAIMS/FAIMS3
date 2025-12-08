import {Skeleton} from '@/components/ui/skeleton';
import {useAuth} from '@/context/auth-provider';
import {useGetTeam} from '@/hooks/queries';
import {Link} from '@tanstack/react-router';

interface TeamCellComponentProps {
  teamId: string;
}

/**
 * Component: TeamCellComponent
 * Renders a team name as a clickable link in a table cell
 */
export const TeamCellComponent = ({teamId}: TeamCellComponentProps) => {
  const {user} = useAuth();

  if (!user) {
    return <p>Unauthenticated</p>;
  }

  const {data: team, isLoading, isError} = useGetTeam(user, teamId);

  return isLoading ? (
    <Skeleton className="h-5 w-24" />
  ) : (
    <div
      className="w-full h-full"
      onClick={e => {
        // Prevent event propagation to avoid conflicts with table row click handlers
        e.stopPropagation();
      }}
    >
      <Link
        to="/teams/$teamId"
        disabled={!team}
        params={{teamId}}
        className={
          'text-gray-700' + team
            ? ' hover:text-gray-900 cursor-pointer transition-colors'
            : ''
        }
      >
        {isError ? teamId : isLoading ? 'Loading...' : team?.name ?? teamId}
      </Link>
    </div>
  );
};
