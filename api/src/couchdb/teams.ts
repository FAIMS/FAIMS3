// SPDX-License-Identifier: Apache-2.0
import {
  ExistingTeamsDBDocument,
  safeWriteDocument,
  slugify,
  TeamsDBDocument,
  TeamsDBFields,
} from '@faims3/data-model';
import {getTeamsDB} from '.';
import * as Exceptions from '../exceptions';

/**
 * Lists all documents in the teams DB.
 * @returns an array of team objects
 */
export const getAllTeams = async (): Promise<ExistingTeamsDBDocument[]> => {
  const teamsDb = getTeamsDB();
  try {
    const resultList = await teamsDb.allDocs<TeamsDBFields>({
      include_docs: true,
    });
    return resultList.rows
      .filter(document => {
        return !!document.doc && !document.id.startsWith('_');
      })
      .map(document => {
        return document.doc!;
      });
  } catch (error) {
    throw new Exceptions.InternalSystemError(
      'An error occurred while reading teams from the Teams DB.'
    );
  }
};

/**
 * Fetches a team by id
 * @param id The ID of the team to retrieve
 * @returns The document if available
 */
export const getTeamById = async (
  id: string
): Promise<ExistingTeamsDBDocument> => {
  const teamsDb = getTeamsDB();
  try {
    return await teamsDb.get(id);
  } catch (error) {
    throw new Exceptions.ItemNotFoundException(
      'An error occurred while reading team from the Teams DB. Are you sure the ID is correct?'
    );
  }
};

/**
 * Generate a team identifier for a new team
 * @param teamName the team name string
 * @returns a suitable team identifier
 */
export const generateTeamId = (teamName: string): string => {
  return `team_${Date.now().toFixed()}_${slugify(teamName)}`;
};

/**
 * Creates a new team record in the teams database.
 * @param payload The document details for a team
 * @returns The created team document
 */
export const createTeamDocument = async (
  payload: TeamsDBFields
): Promise<ExistingTeamsDBDocument> => {
  // Get the teams DB so we can interact with it
  const teamsDb = getTeamsDB();

  // Get a unique id for the team
  const teamId = generateTeamId(payload.name);

  // Setup the document with id included
  const teamDoc: TeamsDBDocument = {
    _id: teamId,
    ...payload,
  };

  // Try putting the new document
  try {
    await teamsDb.put(teamDoc);
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to PUT the new team document into the teams DB. Exception ' +
        e
    );
  }

  // Then return the fetched result
  try {
    return await getTeamById(teamDoc._id);
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to GET the new team document from the teams DB.'
    );
  }
};

export const ARCHIVED_TEAM_MUTATION_MESSAGE =
  'Cannot perform this action on an archived team. Restore the team from the Archive first.';

/** Missing/undefined `archived` reads as active. */
export function teamIsArchived(team: {archived?: boolean}): boolean {
  return team.archived === true;
}

/**
 * Fetches a team and rejects team-as-container mutations while it is archived.
 */
export const assertTeamNotArchived = async (
  teamId: string
): Promise<ExistingTeamsDBDocument> => {
  const team = await getTeamById(teamId);
  if (teamIsArchived(team)) {
    throw new Exceptions.InvalidRequestException(
      ARCHIVED_TEAM_MUTATION_MESSAGE
    );
  }
  return team;
};

/**
 * No-op when `teamId` is omitted or the team document does not exist.
 * Rejects only when the team is present and archived, so callers that
 * historically stored an unknown `ownedByTeamId` keep that behaviour.
 */
export const assertTeamIdNotArchived = async (
  teamId: string | undefined
): Promise<void> => {
  if (!teamId) {
    return;
  }
  try {
    await assertTeamNotArchived(teamId);
  } catch (error) {
    if (error instanceof Exceptions.ItemNotFoundException) {
      return;
    }
    throw error;
  }
};

/**
 * Archives or restores a team (top-level `archived` flag) and bumps `updatedAt`.
 */
export const archiveTeam = async (
  teamId: string,
  archive: boolean
): Promise<ExistingTeamsDBDocument> => {
  const teamsDb = getTeamsDB();
  const existingTeam = await getTeamById(teamId);

  const updatedDoc = {
    ...existingTeam,
    archived: archive,
    updatedAt: Date.now(),
  } satisfies TeamsDBDocument;

  try {
    await safeWriteDocument({db: teamsDb, data: updatedDoc});
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to archive a team. Exception ' +
        e
    );
  }

  try {
    return (await teamsDb.get(teamId)) as ExistingTeamsDBDocument;
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to fetch the archived team.'
    );
  }
};

/**
 * Restores an archived team. Rejected if the team is not archived.
 */
export const restoreTeamFromArchive = async (
  teamId: string
): Promise<ExistingTeamsDBDocument> => {
  const team = await getTeamById(teamId);
  if (!teamIsArchived(team)) {
    throw new Exceptions.InvalidRequestException(
      'Only archived teams can be restored.'
    );
  }
  return archiveTeam(teamId, false);
};

/**
 * Updates an existing team in the teams database
 * @param teamId The ID of the team to update
 * @param payload The updated team data
 * @returns The updated team document
 */
export const updateTeam = async (
  teamId: string,
  payload: Partial<TeamsDBDocument>
): Promise<ExistingTeamsDBDocument> => {
  const teamsDb = getTeamsDB();

  // Fetch the existing team (and refuse while archived)
  let existingTeam;
  try {
    existingTeam = await assertTeamNotArchived(teamId);
  } catch (e) {
    if (e instanceof Exceptions.InvalidRequestException) {
      throw e;
    }
    throw new Exceptions.ItemNotFoundException(
      'An error occurred while trying to fetch an existing team in order to update. Are you sure the ID is correct?'
    );
  }

  // Create the updated document (only allowing superficial updates)
  const updatedDoc = {
    ...existingTeam,
    description: payload.description ?? existingTeam.description,
    name: payload.name ?? existingTeam.name,
    updatedAt: Date.now(),
  } satisfies TeamsDBDocument;

  // Update the document
  try {
    await safeWriteDocument({db: teamsDb, data: updatedDoc});
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to update an existing team.'
    );
  }

  // Return the updated document
  try {
    return (await teamsDb.get(teamId)) as ExistingTeamsDBDocument;
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to fetch the updated team.'
    );
  }
};

/**
 * Deletes a team from the teams database
 * @param teamId The ID of the team to delete
 */
export const deleteTeam = async (teamId: string): Promise<void> => {
  const teamsDb = getTeamsDB();

  // Fetch the existing team
  let existingTeam;
  try {
    existingTeam = await getTeamById(teamId);
  } catch (e) {
    throw new Exceptions.ItemNotFoundException(
      'An error occurred while trying to fetch an existing team in order to delete. Are you sure the ID is correct?'
    );
  }

  if (!teamIsArchived(existingTeam)) {
    throw new Exceptions.InvalidRequestException(
      'Only archived teams can be permanently deleted. Archive the team first, then delete it from the Archive view.'
    );
  }

  // Dynamic import avoids teams ↔ users ↔ auth/helpers cycle at load time.
  const {stripTeamRolesForTeamId} = await import('./users.js');
  await stripTeamRolesForTeamId(teamId);

  // Delete the team
  try {
    await teamsDb.remove(existingTeam);
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to delete an existing team.'
    );
  }
};
