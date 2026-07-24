import {Skeleton} from '@/components/ui/skeleton';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {useGetTeam} from '@/hooks/queries';
import {Link} from '@tanstack/react-router';

interface TeamCellComponentProps {
  teamId: string;
  /**
   * When set (e.g. from GET /api/templates), skips fetching team details — avoids 401
   * for users who can read a public template but not the owning team.
   */
  teamDisplayName?: string;
}

/**
 * Component: TeamCellComponent
 * Renders a team name as a clickable link in a table cell
 */
export const TeamCellComponent = ({
  teamId,
  teamDisplayName,
}: TeamCellComponentProps) => {
  const user = useRequiredUser();
  const hasInjectedName =
    teamDisplayName !== undefined && teamDisplayName.length > 0;

  const {
    data: team,
    isLoading,
    isError,
  } = useGetTeam({
    user,
    teamId,
    enabled: !hasInjectedName,
  });

  const displayLabel = hasInjectedName
    ? teamDisplayName
    : isLoading
      ? undefined
      : isError
        ? teamId
        : (team?.name ?? teamId);

  const linkActive = hasInjectedName || !!team;

  if (!hasInjectedName && isLoading) {
    return <Skeleton className="h-5 w-24" />;
  }

  return (
    <div
      className="w-full h-full"
      onClick={e => {
        // Prevent event propagation to avoid conflicts with table row click handlers
        e.stopPropagation();
      }}
    >
      <Link
        to="/teams/$teamId"
        disabled={!linkActive}
        params={{teamId}}
        className={
          linkActive
            ? 'cursor-pointer text-gray-700 transition-colors hover:text-gray-900'
            : 'text-gray-700'
        }
      >
        {displayLabel ?? 'Loading...'}
      </Link>
    </div>
  );
};
