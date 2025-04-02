/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: src/authkeys/create.ts
 * Description:
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data
 */

import {
  couchUserToResourceRoles,
  expressUserToTokenPermissions,
  PeopleDBDocument,
  Resource,
  ResourceAssociation,
  TokenPayload,
} from '@faims3/data-model';
import {SignJWT} from 'jose';
import {
  ACCESS_TOKEN_EXPIRY_MINUTES,
  CONDUCTOR_PUBLIC_URL,
  KEY_SERVICE,
} from '../buildconfig';
import {createNewRefreshToken} from '../couchdb/refreshTokens';
import type {SigningKey} from '../services/keyService';
import {getProjectIdsByTeamId} from '../couchdb/notebooks';
import {getTemplateIdsByTeamId} from '../couchdb/templates';

const ASSOCIATIVE_RESOURCES = [Resource.TEMPLATE, Resource.PROJECT];

/**
 * Given a db user, looks at their team roles, then for each team, looks up
 * projects and templates owned by that team. This then produces a
 * ResourceAssociation array which is a collection of associations from
 * Resources to other resources. This allows virtual role propagation where a
 * role in a Team, for example, grants roles in resources owned by the team.
 */
export async function getRelevantUserAssociations({
  dbUser,
}: {
  dbUser: PeopleDBDocument;
}): Promise<ResourceAssociation[]> {
  // To determine relevant associations we need to for each team the user is on,
  // find what resources (projects, templates (currently!)) the team owns, then
  // include that
  let relevantAssociations: ResourceAssociation[] = [];
  for (const teamRole of dbUser.teamRoles) {
    const teamId = teamRole.resourceId;
    for (const targetResource of ASSOCIATIVE_RESOURCES) {
      if (targetResource === Resource.PROJECT) {
        // Get all projects owned by the team and add this association
        const projectsForTeam = await getProjectIdsByTeamId({teamId});
        relevantAssociations.push({
          resource: {resourceId: teamId, resourceType: Resource.TEAM},
          associatedResources: projectsForTeam.map(projectId => ({
            resourceId: projectId,
            resourceType: Resource.PROJECT,
          })),
        });
      } else if (targetResource === Resource.TEMPLATE) {
        // Get all templates owned by the team and add this association
        const templatesForTeam = await getTemplateIdsByTeamId({teamId});
        relevantAssociations.push({
          resource: {resourceId: teamId, resourceType: Resource.TEAM},
          associatedResources: templatesForTeam.map(templateId => ({
            resourceId: templateId,
            resourceType: Resource.TEMPLATE,
          })),
        });
      } else {
        throw new Error(
          'No method registered to find associations for resource: ' +
            targetResource
        );
      }
    }
  }
  return relevantAssociations;
}

/**
 * Adds in the resource roles by querying for associative relationships.
 *
 * This converts a database user to an active Express.User for which we can
 * assert permissions against their global and resourceRoles.
 *
 * The reason for this additional step is such that we can reuse the associative
 * logic throughout any authorisation context, including for signing tokens. It
 * also means we can directly decode from a token into an express user (saving
 * time to recompute this on server side).
 *
 * @warning - this should not be used casually - as it requires some db queries.
 *
 * @param dbUser - The database people entry for this user
 * @return The Express.User with the drilled/properly encoded resource roles
 */
export async function upgradeDbUserToExpressUser({
  dbUser,
}: {
  dbUser: PeopleDBDocument;
}): Promise<Express.User> {
  // Work out relevant connected entities
  const relevantAssociations = await getRelevantUserAssociations({dbUser});

  // Use the data model method to encode virtual roles -> resourceRoles
  const resourceRoles = couchUserToResourceRoles({
    user: dbUser,
    relevantAssociations,
  });

  return {...dbUser, resourceRoles};
}

/**
 * Given an express user and signing key, will produce a JWT which encodes the
 * users permissions according to the data model encoding protocol.
 *
 * Note that only the global and resource roles are included in the token -
 * along with the _couchdb.roles.
 *
 * @returns JWT signed with public key
 */
export async function generateJwtFromUser({
  user,
  signingKey,
}: {
  user: Express.User;
  signingKey: SigningKey;
}) {
  // The data model provides this encoding method - it takes the couch user
  // details and determines how to put that into the token
  try {
    const permissionsComponent = expressUserToTokenPermissions({
      user,
    });

    // We then augment this with extra details to help identify the origin of the
    // token + user details
    const completePayload: TokenPayload = {
      ...permissionsComponent,
      name: user.name,
      server: CONDUCTOR_PUBLIC_URL,
    };

    // Then there are other parts we wish to include
    const jwt = await new SignJWT(completePayload)
      .setProtectedHeader({
        alg: signingKey.alg,
        kid: signingKey.kid,
      })
      .setSubject(user.user_id)
      .setIssuedAt()
      .setIssuer(signingKey.instanceName)
      // Expiry in minutes
      .setExpirationTime(ACCESS_TOKEN_EXPIRY_MINUTES.toString() + 'm')
      .sign(signingKey.privateKey);

    return jwt;
  } catch (e) {
    console.error('ERROR: ' + e);
    throw e;
  }
}

/**
 * Generates a token for an express user. Also generates a reusable refresh
 * token.
 * @param user The passport user
 * @returns The generated token which is a payload containing the actual JWT +
 * refresh token + other information
 */
export async function generateUserToken(user: Express.User, refresh = false) {
  const signingKey = await KEY_SERVICE.getSigningKey();

  if (signingKey === null || signingKey === undefined) {
    throw new Error('No signing key is available, check configuration');
  } else {
    const token = await generateJwtFromUser({user, signingKey});

    return {
      token: token,
      // Provide a refresh token if necessary
      refreshToken: refresh
        ? (await createNewRefreshToken(user._id!)).token
        : undefined,
      pubkey: signingKey.publicKeyString,
      pubalg: signingKey.alg,
    };
  }
}
