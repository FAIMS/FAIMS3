// SPDX-License-Identifier: Apache-2.0
import {ArchiveTeamDialog} from '@/components/dialogs/archive-team-dialog';
import {UpdateTeamDialog} from '@/components/dialogs/teams/update-team-dialog';
import {Card} from '@/components/ui/card';
import {List, ListDescription, ListItem, ListLabel} from '@/components/ui/list';
import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {useGetTeam} from '@/hooks/queries';
import {Action} from '@faims3/data-model';

/**
 * TeamActions renders action cards for editing team details and archiving the
 * team, matching the Actions tab used by other Control Centre resources.
 */
const TeamActions = ({teamId}: {teamId: string}) => {
  const {user} = useAuth();
  const {data} = useGetTeam({user, teamId});

  const canEditTeamDetails = useIsAuthorisedTo({
    action: Action.UPDATE_TEAM_DETAILS,
    resourceId: teamId,
  });
  const canChangeTeamStatus = useIsAuthorisedTo({
    action: Action.CHANGE_TEAM_STATUS,
    resourceId: teamId,
  });

  const archived = data?.archived === true;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {canEditTeamDetails && !archived && (
        <Card>
          <List>
            <ListItem>
              <ListLabel>Edit Team details</ListLabel>
              <ListDescription>
                Update team name and description.
              </ListDescription>
            </ListItem>
            <ListItem>
              <UpdateTeamDialog teamId={teamId} />
            </ListItem>
          </List>
        </Card>
      )}
      {canChangeTeamStatus ? (
        <Card>
          <List>
            {archived ? (
              <ListItem>
                <ListLabel>Un-archive Team</ListLabel>
                <ListDescription>
                  Restore this team so it appears in Teams lists and can be used
                  again.
                </ListDescription>
              </ListItem>
            ) : (
              <ListItem>
                <ListLabel>Archive Team</ListLabel>
                <ListDescription>
                  Hide this team from default lists and stop new membership,
                  invites, and creation of new resources in this team.
                </ListDescription>
              </ListItem>
            )}
            <ListItem>
              <ArchiveTeamDialog archived={archived} />
            </ListItem>
          </List>
        </Card>
      ) : null}
    </div>
  );
};

export default TeamActions;
