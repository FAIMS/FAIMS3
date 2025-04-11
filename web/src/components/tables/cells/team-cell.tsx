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

  const {data: team, isLoading} = useGetTeam(user, teamId);

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
        params={{teamId}}
        className="text-gray-700 hover:text-gray-900 hover:underline cursor-pointer transition-colors"
      >
        {team?.name ?? 'Loading...'}
      </Link>
    </div>
  );
};
