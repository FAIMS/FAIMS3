// SPDX-License-Identifier: Apache-2.0
import {
  Action,
  COUCHDB_ROLES_PATH,
  DecodedTokenPermissions,
  encodeToken,
  ENCODING_SEPARATOR,
  generateVirtualResourceRoles,
  isAuthorizedForMapAsset,
  isAuthorizedToMutateMapAsset,
  isAuthorizedToReplaceMapAssetFiles,
  Resource,
  Role,
  roleDetails,
  teamGrantsMapAssetAction,
  virtualRolesGrantedBy,
} from '../src';

const teamId = 'team-1';
const assetId = 'asset-1';
const ownerId = 'user-owner';
const otherId = 'user-other';

const personalAsset = {
  _id: assetId,
  createdBy: ownerId,
};

const teamAsset = {
  _id: assetId,
  createdBy: ownerId,
  ownedByTeamId: teamId,
};

function token({
  globalRoles = [],
  resourceRoles = [],
}: Partial<DecodedTokenPermissions> = {}): DecodedTokenPermissions {
  return {globalRoles, resourceRoles};
}

function teamToken(role: Role, extra?: Partial<DecodedTokenPermissions>) {
  return token({
    resourceRoles: [{resourceId: teamId, role}],
    ...extra,
  });
}

describe('map asset permission model', () => {
  it('does not encode map-layer roles in tokens', () => {
    expect(roleDetails[Role.MAP_ASSET_GUEST].encodeInToken).toBe(false);
    expect(roleDetails[Role.MAP_ASSET_MANAGER].encodeInToken).toBe(false);
    expect(roleDetails[Role.MAP_ASSET_ADMIN].encodeInToken).toBe(false);
    expect(roleDetails[Role.PROJECT_ADMIN].encodeInToken).not.toBe(false);
    expect(roleDetails[Role.TEAM_MEMBER].encodeInToken).not.toBe(false);
  });

  it('strips map-layer roles from JWTs and CouchDB roles', () => {
    const encoded = encodeToken({
      globalRoles: [Role.GENERAL_USER],
      resourceRoles: [
        {resourceId: 'survey-1', role: Role.PROJECT_GUEST},
        {resourceId: assetId, role: Role.MAP_ASSET_ADMIN},
      ],
    });

    expect(encoded.resourceRoles).toEqual([
      `survey-1${ENCODING_SEPARATOR}${Role.PROJECT_GUEST}`,
    ]);
    expect(encoded[COUCHDB_ROLES_PATH]).toEqual([
      Role.GENERAL_USER,
      `survey-1${ENCODING_SEPARATOR}${Role.PROJECT_GUEST}`,
    ]);
  });

  it('does not explode team-owned map layers into virtual token roles', () => {
    const virtualRoles = generateVirtualResourceRoles({
      resourceRoles: [{resourceId: teamId, role: Role.TEAM_ADMIN}],
      resourceAssociations: [
        {
          resource: {resourceId: teamId, resourceType: Resource.TEAM},
          associatedResources: [
            {resourceId: 'survey-1', resourceType: Resource.PROJECT},
            {resourceId: assetId, resourceType: Resource.MAP_ASSET},
          ],
        },
      ],
    });

    expect(virtualRoles).toContainEqual({
      resourceId: 'survey-1',
      role: Role.PROJECT_ADMIN,
    });
    expect(virtualRoles.some(role => role.role === Role.MAP_ASSET_ADMIN)).toBe(
      false
    );
    expect(virtualRoles.some(role => role.resourceId === assetId)).toBe(false);
  });

  it('maps team roles to map-layer roles for request-time proxy', () => {
    expect(
      virtualRolesGrantedBy({
        role: Role.TEAM_MEMBER,
        resourceType: Resource.MAP_ASSET,
      })
    ).toEqual([Role.MAP_ASSET_GUEST]);
    expect(
      virtualRolesGrantedBy({
        role: Role.TEAM_MEMBER_CREATOR,
        resourceType: Resource.MAP_ASSET,
      })
    ).toEqual([]);
    expect(
      virtualRolesGrantedBy({
        role: Role.TEAM_MANAGER,
        resourceType: Resource.MAP_ASSET,
      })
    ).toEqual([Role.MAP_ASSET_MANAGER]);
    expect(
      virtualRolesGrantedBy({
        role: Role.TEAM_ADMIN,
        resourceType: Resource.MAP_ASSET,
      })
    ).toEqual([Role.MAP_ASSET_ADMIN]);
  });
});

describe('isAuthorizedForMapAsset', () => {
  it('lets the creator administer a personal layer', () => {
    const decodedToken = token({globalRoles: [Role.GENERAL_USER]});
    expect(
      isAuthorizedForMapAsset({
        decodedToken,
        action: Action.READ_MAP_ASSET,
        asset: personalAsset,
        actingUserId: ownerId,
      })
    ).toBe(true);
    expect(
      isAuthorizedForMapAsset({
        decodedToken,
        action: Action.DELETE_MAP_ASSET,
        asset: personalAsset,
        actingUserId: ownerId,
      })
    ).toBe(true);
  });

  it('does not let another user read an unlinked personal layer', () => {
    expect(
      isAuthorizedForMapAsset({
        decodedToken: token({globalRoles: [Role.GENERAL_USER]}),
        action: Action.READ_MAP_ASSET,
        asset: personalAsset,
        actingUserId: otherId,
      })
    ).toBe(false);
  });

  it('lets a team member read team layers but not change them', () => {
    const decodedToken = teamToken(Role.TEAM_MEMBER);
    expect(
      isAuthorizedForMapAsset({
        decodedToken,
        action: Action.READ_MAP_ASSET,
        asset: teamAsset,
        actingUserId: otherId,
      })
    ).toBe(true);
    expect(
      isAuthorizedForMapAsset({
        decodedToken,
        action: Action.UPDATE_MAP_ASSET_FILES,
        asset: teamAsset,
        actingUserId: otherId,
      })
    ).toBe(false);
    expect(
      isAuthorizedForMapAsset({
        decodedToken,
        action: Action.DELETE_MAP_ASSET,
        asset: teamAsset,
        actingUserId: otherId,
      })
    ).toBe(false);
  });

  it('does not let a team member creator see existing team layers they did not upload', () => {
    const decodedToken = teamToken(Role.TEAM_MEMBER_CREATOR);
    expect(
      isAuthorizedForMapAsset({
        decodedToken,
        action: Action.READ_MAP_ASSET,
        asset: teamAsset,
        actingUserId: otherId,
      })
    ).toBe(false);
    expect(
      teamGrantsMapAssetAction({
        decodedToken,
        teamId,
        action: Action.READ_MAP_ASSET,
      })
    ).toBe(false);
  });

  it('lets a team member creator administer layers they uploaded into the team', () => {
    const decodedToken = teamToken(Role.TEAM_MEMBER_CREATOR);
    expect(
      isAuthorizedForMapAsset({
        decodedToken,
        action: Action.READ_MAP_ASSET,
        asset: teamAsset,
        actingUserId: ownerId,
      })
    ).toBe(true);
    expect(
      isAuthorizedForMapAsset({
        decodedToken,
        action: Action.DELETE_MAP_ASSET,
        asset: teamAsset,
        actingUserId: ownerId,
      })
    ).toBe(true);
  });

  it('lets a team manager update files but not delete someone else’s layer', () => {
    const decodedToken = teamToken(Role.TEAM_MANAGER);
    expect(
      isAuthorizedForMapAsset({
        decodedToken,
        action: Action.UPDATE_MAP_ASSET_DETAILS,
        asset: teamAsset,
        actingUserId: otherId,
      })
    ).toBe(true);
    expect(
      isAuthorizedForMapAsset({
        decodedToken,
        action: Action.UPDATE_MAP_ASSET_FILES,
        asset: teamAsset,
        actingUserId: otherId,
      })
    ).toBe(true);
    expect(
      isAuthorizedForMapAsset({
        decodedToken,
        action: Action.DELETE_MAP_ASSET,
        asset: teamAsset,
        actingUserId: otherId,
      })
    ).toBe(false);
  });

  it('lets a team admin delete team layers', () => {
    expect(
      isAuthorizedForMapAsset({
        decodedToken: teamToken(Role.TEAM_ADMIN),
        action: Action.DELETE_MAP_ASSET,
        asset: teamAsset,
        actingUserId: otherId,
      })
    ).toBe(true);
  });

  it('lets a super user act on any layer via global MAP_ASSET_ADMIN', () => {
    const decodedToken = token({globalRoles: [Role.GENERAL_ADMIN]});
    expect(
      isAuthorizedForMapAsset({
        decodedToken,
        action: Action.READ_MAP_ASSET,
        asset: personalAsset,
        actingUserId: otherId,
      })
    ).toBe(true);
    expect(
      isAuthorizedForMapAsset({
        decodedToken,
        action: Action.DELETE_MAP_ASSET,
        asset: teamAsset,
        actingUserId: otherId,
      })
    ).toBe(true);
  });

  it('does not let an operations admin read map layers', () => {
    expect(
      isAuthorizedForMapAsset({
        decodedToken: token({globalRoles: [Role.OPERATIONS_ADMIN]}),
        action: Action.READ_MAP_ASSET,
        asset: teamAsset,
        actingUserId: otherId,
      })
    ).toBe(false);
  });

  it('lets a survey guest download a linked layer but not manage it', () => {
    const decodedToken = token({
      resourceRoles: [{resourceId: 'survey-1', role: Role.PROJECT_GUEST}],
    });
    expect(
      isAuthorizedForMapAsset({
        decodedToken,
        action: Action.READ_MAP_ASSET,
        asset: personalAsset,
        actingUserId: otherId,
        linkedProjectIds: ['survey-1'],
      })
    ).toBe(true);
    expect(
      isAuthorizedForMapAsset({
        decodedToken,
        action: Action.UPDATE_MAP_ASSET_FILES,
        asset: personalAsset,
        actingUserId: otherId,
        linkedProjectIds: ['survey-1'],
      })
    ).toBe(false);
    expect(
      isAuthorizedForMapAsset({
        decodedToken,
        action: Action.DELETE_MAP_ASSET,
        asset: personalAsset,
        actingUserId: otherId,
        linkedProjectIds: ['survey-1'],
      })
    ).toBe(false);
  });

  it('does not let another global creator replace a personal layer they only read via a survey link', () => {
    const decodedToken = token({
      globalRoles: [Role.GENERAL_CREATOR],
      resourceRoles: [{resourceId: 'survey-1', role: Role.PROJECT_GUEST}],
    });
    expect(
      isAuthorizedForMapAsset({
        decodedToken,
        action: Action.READ_MAP_ASSET,
        asset: personalAsset,
        actingUserId: otherId,
        linkedProjectIds: ['survey-1'],
      })
    ).toBe(true);
    expect(
      isAuthorizedForMapAsset({
        decodedToken,
        action: Action.UPDATE_MAP_ASSET_FILES,
        asset: personalAsset,
        actingUserId: otherId,
        linkedProjectIds: ['survey-1'],
      })
    ).toBe(false);
    expect(
      isAuthorizedToReplaceMapAssetFiles({
        decodedToken,
        asset: personalAsset,
        actingUserId: otherId,
        linkedProjectIds: ['survey-1'],
      })
    ).toBe(false);
  });

  it('uses the shared replace helper for team managers, not upload-or-read', () => {
    const manager = teamToken(Role.TEAM_MANAGER);
    const member = teamToken(Role.TEAM_MEMBER);
    expect(
      isAuthorizedToReplaceMapAssetFiles({
        decodedToken: manager,
        asset: teamAsset,
        actingUserId: otherId,
      })
    ).toBe(true);
    expect(
      isAuthorizedToReplaceMapAssetFiles({
        decodedToken: member,
        asset: teamAsset,
        actingUserId: otherId,
      })
    ).toBe(false);
    expect(
      isAuthorizedToMutateMapAsset({
        decodedToken: manager,
        asset: teamAsset,
        actingUserId: otherId,
      })
    ).toBe(true);
    expect(
      isAuthorizedToMutateMapAsset({
        decodedToken: member,
        asset: teamAsset,
        actingUserId: otherId,
      })
    ).toBe(false);
  });
});
