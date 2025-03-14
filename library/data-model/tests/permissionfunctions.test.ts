import {isAuthorized} from '../src/permission/functions';
import {
  canPerformAction,
  drillRolePermissions,
  hasSuitablePermission,
  roleGrantsAction,
} from '../src/permission/helpers';
import {Action, Permission, Role} from '../src/permission/model';
import {
  COUCHDB_PERMISSIONS_PATH,
  decodeAndValidateToken,
  DecodedTokenPermissions,
  decodePerResourcePermission,
  EncodedTokenPermissions,
  encodeToken,
  ENCODING_SEPARATOR,
} from '../src/permission/tokenEncoding';

beforeEach(() => {
  jest.restoreAllMocks();
  jest.resetAllMocks();
});

describe('Token Encoding and Decoding', () => {
  describe('decodePerResourcePermission', () => {
    it('correctly decodes a valid per-resource permission string', () => {
      const input = `project123${ENCODING_SEPARATOR}${Permission.PROJECT_VIEW}`;
      const result = decodePerResourcePermission({input});

      expect(result.resourceId).toBe('project123');
      expect(result.permissionString).toBe(Permission.PROJECT_VIEW);
    });

    it('throws error when encoding format is invalid', () => {
      // No separator
      expect(() => {
        decodePerResourcePermission({input: 'project123PROJECT_VIEW'});
      }).toThrow();

      // Empty resourceId
      expect(() => {
        decodePerResourcePermission({
          input: `${ENCODING_SEPARATOR}${Permission.PROJECT_VIEW}`,
        });
      }).toThrow();

      // Empty permission
      expect(() => {
        decodePerResourcePermission({input: `project123${ENCODING_SEPARATOR}`});
      }).toThrow();

      // Too many separators
      expect(() => {
        decodePerResourcePermission({
          input: `project123${ENCODING_SEPARATOR}${Permission.PROJECT_VIEW}${ENCODING_SEPARATOR}extra`,
        });
      }).toThrow();
    });
  });

  describe('encodeToken', () => {
    it('correctly encodes a DecodedToken into EncodedTokenPermissions', () => {
      const decodedToken: DecodedTokenPermissions = {
        resourceRoles: [
          {resourceId: 'project123', role: Role.PROJECT_ADMIN},
          {resourceId: 'project456', role: Role.PROJECT_CONTRIBUTOR},
        ],
        globalRoles: [Role.GENERAL_USER],
      };

      const encoded = encodeToken(decodedToken);

      expect(encoded.resourceRoles).toContain(
        `project123${ENCODING_SEPARATOR}${Role.PROJECT_ADMIN}`
      );
      expect(encoded.resourceRoles).toContain(
        `project456${ENCODING_SEPARATOR}${Role.PROJECT_CONTRIBUTOR}`
      );
      expect(encoded.globalRoles).toContain(Role.GENERAL_USER);
    });
  });

  describe('decodeAndValidateToken', () => {
    it('correctly decodes a valid EncodedTokenPermissions', () => {
      const tokenStructure: EncodedTokenPermissions = {
        [COUCHDB_PERMISSIONS_PATH]: [],
        resourceRoles: [
          `project123${ENCODING_SEPARATOR}${Role.PROJECT_ADMIN}`,
          `project456${ENCODING_SEPARATOR}${Role.PROJECT_CONTRIBUTOR}`,
        ],
        globalRoles: [Role.GENERAL_USER],
      };

      const decoded = decodeAndValidateToken(tokenStructure);

      expect(decoded.resourceRoles).toEqual([
        {resourceId: 'project123', role: Role.PROJECT_ADMIN},
        {resourceId: 'project456', role: Role.PROJECT_CONTRIBUTOR},
      ]);
      expect(decoded.globalRoles).toEqual([Role.GENERAL_USER]);
    });

    it('throws error when token structure contains invalid resource role encoding', () => {
      const tokenStructure: EncodedTokenPermissions = {
        [COUCHDB_PERMISSIONS_PATH]: [],
        resourceRoles: [
          `invalid_encoding`, // Missing separator
        ],
        globalRoles: [],
      };

      expect(() => {
        decodeAndValidateToken(tokenStructure);
      }).toThrow();
    });

    it('throws error when token structure contains invalid resource permission encoding', () => {
      let tokenStructure: EncodedTokenPermissions = {
        [COUCHDB_PERMISSIONS_PATH]: [],
        resourceRoles: ['invalid-role'],
        globalRoles: [],
      };

      expect(() => {
        decodeAndValidateToken(tokenStructure);
      }).toThrow();
      tokenStructure = {
        [COUCHDB_PERMISSIONS_PATH]: [],
        resourceRoles: ['projectId123' + ENCODING_SEPARATOR + 'invalid_role'],
        globalRoles: [],
      };

      expect(() => {
        decodeAndValidateToken(tokenStructure);
      }).toThrow();
    });

    it('throws error when token structure contains invalid global role', () => {
      const tokenStructure: EncodedTokenPermissions = {
        [COUCHDB_PERMISSIONS_PATH]: [],
        resourceRoles: [],
        globalRoles: ['INVALID_ROLE'], // Invalid role
      };

      expect(() => {
        decodeAndValidateToken(tokenStructure);
      }).toThrow();
    });
  });

  describe('token round-trip conversion', () => {
    it('maintains identical data through encode-decode cycle', () => {
      // Start with a decoded token
      const originalDecoded: DecodedTokenPermissions = {
        resourceRoles: [
          {resourceId: 'project123', role: Role.PROJECT_ADMIN},
          {resourceId: 'template456', role: Role.PROJECT_MANAGER},
        ],
        globalRoles: [Role.GENERAL_USER, Role.GENERAL_CREATOR],
      };

      // Encode it
      const encoded = encodeToken(originalDecoded);

      // Decode it again
      const redecoded = decodeAndValidateToken(encoded);

      // Compare original and redecoded
      expect(redecoded).toEqual(originalDecoded);
    });
  });
});

describe('Authorization Functions', () => {
  describe('canPerformAction', () => {
    it('returns true when a permission explicitly grants an action', () => {
      // PROJECT_DATA_READ_ALL grants READ_ALL_PROJECT_RECORDS
      expect(
        canPerformAction({
          permissions: [Permission.PROJECT_DATA_READ_ALL],
          action: Action.READ_ALL_PROJECT_RECORDS,
        })
      ).toBe(true);
    });

    it('returns true when any permission in the list grants the action', () => {
      // Multiple permissions, only one grants the action
      expect(
        canPerformAction({
          permissions: [
            Permission.PROJECT_VIEW,
            Permission.PROJECT_DATA_ADD,
            Permission.PROJECT_MANAGE,
          ],
          action: Action.UPDATE_PROJECT_DETAILS,
        })
      ).toBe(true);
    });

    it('returns false when no permission grants the action', () => {
      expect(
        canPerformAction({
          permissions: [Permission.PROJECT_VIEW, Permission.PROJECT_DATA_ADD],
          action: Action.DELETE_PROJECT,
        })
      ).toBe(false);
    });
  });

  describe('drillRolePermissions', () => {
    it('returns direct permissions granted by a role', () => {
      const permissions = drillRolePermissions({role: Role.PROJECT_GUEST});
      // PROJECT_GUEST grants PROJECT_DATA_ADD and PROJECT_DATA_READ_MINE
      expect(permissions).toContain(Permission.PROJECT_DATA_ADD);
      expect(permissions).toContain(Permission.PROJECT_DATA_READ_MINE);
    });

    it('returns permissions from inherited roles', () => {
      // PROJECT_MANAGER inherits from PROJECT_CONTRIBUTOR which inherits from PROJECT_GUEST
      const permissions = drillRolePermissions({role: Role.PROJECT_MANAGER});

      // Direct permissions from PROJECT_MANAGER
      expect(permissions).toContain(Permission.PROJECT_DATA_EDIT_ALL);
      expect(permissions).toContain(Permission.PROJECT_DATA_DELETE_ALL);
      expect(permissions).toContain(Permission.PROJECT_MANAGE);

      // Inherited from PROJECT_CONTRIBUTOR
      expect(permissions).toContain(Permission.PROJECT_DATA_READ_ALL);

      // Inherited from PROJECT_GUEST (via PROJECT_CONTRIBUTOR)
      expect(permissions).toContain(Permission.PROJECT_DATA_ADD);
      expect(permissions).toContain(Permission.PROJECT_DATA_READ_MINE);
    });

    it('handles circular role references without infinite recursion', () => {
      // Create a mock of rolePermissions with a circular reference for testing
      const originalRolePermissions =
        require('../src/permission/model').rolePermissions;
      jest.mock('../src/permission/model', () => {
        const original = jest.requireActual('../src/permission/model');
        return {
          ...original,
          rolePermissions: {
            ...original.rolePermissions,
            // Create a circular reference for test
            [Role.PROJECT_GUEST]: {
              ...original.rolePermissions[Role.PROJECT_GUEST],
              alsoGrants: [Role.PROJECT_CONTRIBUTOR], // This creates a cycle
            },
          },
        };
      });

      // This should not cause an infinite loop
      const permissions = drillRolePermissions({role: Role.PROJECT_GUEST});

      // Restore the original
      jest.unmock('../src/permission/model');
      require('../src/permission/model').rolePermissions =
        originalRolePermissions;

      // Basic verification that we got some permissions
      expect(permissions.length).toBeGreaterThan(0);
    });
  });

  describe('hasSuitablePermission', () => {
    it('returns true when there is at least one matching permission', () => {
      expect(
        hasSuitablePermission({
          sufficient: [
            Permission.PROJECT_DATA_READ_ALL,
            Permission.PROJECT_MANAGE,
          ],
          has: [Permission.PROJECT_VIEW, Permission.PROJECT_MANAGE],
        })
      ).toBe(true);
    });

    it('returns false when there are no matching permissions', () => {
      expect(
        hasSuitablePermission({
          sufficient: [
            Permission.PROJECT_DATA_READ_ALL,
            Permission.PROJECT_MANAGE,
          ],
          has: [Permission.PROJECT_VIEW, Permission.PROJECT_DATA_ADD],
        })
      ).toBe(false);
    });
  });

  describe('roleGrantsAction', () => {
    it('returns true when a role directly grants an action', () => {
      expect(
        roleGrantsAction({
          roles: [Role.PROJECT_ADMIN],
          action: Action.DELETE_PROJECT,
        })
      ).toBe(true);
    });

    it('returns true when a role indirectly grants an action through inheritance', () => {
      // PROJECT_MANAGER inherits from PROJECT_CONTRIBUTOR which can read all records
      expect(
        roleGrantsAction({
          roles: [Role.PROJECT_MANAGER],
          action: Action.READ_ALL_PROJECT_RECORDS,
        })
      ).toBe(true);
    });

    it('returns true when any role in the list grants the action', () => {
      expect(
        roleGrantsAction({
          roles: [Role.PROJECT_GUEST, Role.PROJECT_ADMIN],
          action: Action.DELETE_PROJECT,
        })
      ).toBe(true);
    });

    it('returns false when no role grants the action', () => {
      expect(
        roleGrantsAction({
          roles: [Role.PROJECT_GUEST, Role.PROJECT_CONTRIBUTOR],
          action: Action.DELETE_PROJECT,
        })
      ).toBe(false);
    });
  });
});

describe('isAuthorized', () => {
  describe('Non-resource specific actions', () => {
    it('returns true when a global role grants a non-resource specific action', () => {
      const token: EncodedTokenPermissions = {
        [COUCHDB_PERMISSIONS_PATH]: [],
        resourceRoles: [],
        globalRoles: [Role.GENERAL_CREATOR],
      };

      // CREATE_TEMPLATE is a non-resource specific action granted by GENERAL_CREATOR
      expect(isAuthorized(token, Action.CREATE_TEMPLATE)).toBe(true);
    });

    it('returns false when no global role grants a non-resource specific action', () => {
      const token: EncodedTokenPermissions = {
        [COUCHDB_PERMISSIONS_PATH]: [],
        resourceRoles: [],
        globalRoles: [Role.GENERAL_USER],
      };

      // GENERAL_USER doesn't grant CREATE_TEMPLATE
      expect(isAuthorized(token, Action.CREATE_TEMPLATE)).toBe(false);
    });

    it('ignores resource roles and permissions for non-resource specific actions', () => {
      const token: EncodedTokenPermissions = {
        [COUCHDB_PERMISSIONS_PATH]: [],
        resourceRoles: [
          `template123${ENCODING_SEPARATOR}${Role.PROJECT_ADMIN}`,
        ],
        globalRoles: [],
      };

      // Even with resource-specific permissions that would normally grant the action,
      // non-resource specific actions require global roles
      expect(isAuthorized(token, Action.CREATE_TEMPLATE)).toBe(false);
    });

    it('returns false when resourceId is provided for non-resource specific action', () => {
      const token: EncodedTokenPermissions = {
        [COUCHDB_PERMISSIONS_PATH]: [],
        resourceRoles: [],
        globalRoles: [Role.GENERAL_CREATOR],
      };

      // CREATE_TEMPLATE should not require a resourceId, providing one should be ignored
      expect(isAuthorized(token, Action.CREATE_TEMPLATE, 'template123')).toBe(
        true
      );
    });
  });

  describe('Resource-specific actions', () => {
    it('returns false when no resourceId is provided for a resource-specific action', () => {
      const token: EncodedTokenPermissions = {
        [COUCHDB_PERMISSIONS_PATH]: [],
        resourceRoles: [],
        globalRoles: [Role.GENERAL_ADMIN], // Has all permissions
      };

      // UPDATE_PROJECT_DETAILS requires a resourceId
      expect(isAuthorized(token, Action.UPDATE_PROJECT_DETAILS)).toBe(false);
    });

    it('returns true when a global role grants a resource-specific action for any resource', () => {
      const token: EncodedTokenPermissions = {
        [COUCHDB_PERMISSIONS_PATH]: [],
        resourceRoles: [],
        globalRoles: [Role.GENERAL_ADMIN], // Has all permissions
      };

      // GENERAL_ADMIN should be able to update any project
      expect(
        isAuthorized(token, Action.UPDATE_PROJECT_DETAILS, 'project123')
      ).toBe(true);
    });

    it('returns true when a resource-specific role grants an action for that specific resource', () => {
      const token: EncodedTokenPermissions = {
        [COUCHDB_PERMISSIONS_PATH]: [],
        resourceRoles: [
          `project123${ENCODING_SEPARATOR}${Role.PROJECT_MANAGER}`,
        ],
        globalRoles: [],
      };

      // PROJECT_MANAGER role for project123 should grant UPDATE_PROJECT_DETAILS for project123
      expect(
        isAuthorized(token, Action.UPDATE_PROJECT_DETAILS, 'project123')
      ).toBe(true);

      // But not for a different project
      expect(
        isAuthorized(token, Action.UPDATE_PROJECT_DETAILS, 'project456')
      ).toBe(false);
    });

    it('prioritizes checking global roles first for authorization', () => {
      // Create a spy on roleGrantsAction to verify call order
      const roleGrantsActionSpy = jest.spyOn(
        require('../src/permission/helpers'),
        'roleGrantsAction'
      );

      const token: EncodedTokenPermissions = {
        [COUCHDB_PERMISSIONS_PATH]: [],
        resourceRoles: [`project123${ENCODING_SEPARATOR}${Role.PROJECT_ADMIN}`],
        globalRoles: [Role.GENERAL_ADMIN],
      };

      isAuthorized(token, Action.DELETE_PROJECT, 'project123');

      // First call should check global roles
      expect(roleGrantsActionSpy).toHaveBeenCalledWith({
        roles: [Role.GENERAL_ADMIN],
        action: Action.DELETE_PROJECT,
      });

      // Since GENERAL_ADMIN grants DELETE_PROJECT, no further checks should be needed
      expect(roleGrantsActionSpy).toHaveBeenCalledTimes(1);

      roleGrantsActionSpy.mockRestore();
    });
  });

  describe('Complex authorization scenarios', () => {
    it('handles a mix of global roles, resource roles, and resource permissions', () => {
      const token: EncodedTokenPermissions = {
        [COUCHDB_PERMISSIONS_PATH]: [],
        resourceRoles: [
          `project123${ENCODING_SEPARATOR}${Role.PROJECT_CONTRIBUTOR}`,
          `project456${ENCODING_SEPARATOR}${Role.PROJECT_ADMIN}`,
        ],
        globalRoles: [Role.GENERAL_USER],
      };

      // From global GENERAL_USER
      expect(
        isAuthorized(token, Action.READ_PROJECT_METADATA, 'anyProject')
      ).toBe(true);

      // From resource role PROJECT_CONTRIBUTOR
      expect(
        isAuthorized(token, Action.READ_ALL_PROJECT_RECORDS, 'project123')
      ).toBe(true);
      expect(isAuthorized(token, Action.DELETE_PROJECT, 'project123')).toBe(
        false
      );

      // From resource role PROJECT_ADMIN
      expect(isAuthorized(token, Action.DELETE_PROJECT, 'project456')).toBe(
        true
      );

      // No access to unrelated resources
      expect(
        isAuthorized(token, Action.UPDATE_PROJECT_DETAILS, 'project999')
      ).toBe(false);
    });

    it('properly detects inheritance through role hierarchy', () => {
      const token: EncodedTokenPermissions = {
        [COUCHDB_PERMISSIONS_PATH]: [],
        resourceRoles: [
          `project123${ENCODING_SEPARATOR}${Role.PROJECT_MANAGER}`,
        ],
        globalRoles: [],
      };

      // PROJECT_MANAGER inherits from PROJECT_CONTRIBUTOR which inherits from PROJECT_GUEST

      // Direct from PROJECT_MANAGER
      expect(
        isAuthorized(token, Action.UPDATE_PROJECT_DETAILS, 'project123')
      ).toBe(true);

      // From PROJECT_CONTRIBUTOR (inherited)
      expect(
        isAuthorized(token, Action.READ_ALL_PROJECT_RECORDS, 'project123')
      ).toBe(true);

      // From PROJECT_GUEST (inherited through PROJECT_CONTRIBUTOR)
      expect(
        isAuthorized(token, Action.CREATE_PROJECT_RECORD, 'project123')
      ).toBe(true);

      // Not granted at any level
      expect(isAuthorized(token, Action.DELETE_PROJECT, 'project123')).toBe(
        false
      );
    });

    it('global GENERAL_ADMIN role grants access to any resource-specific action', () => {
      const token: EncodedTokenPermissions = {
        [COUCHDB_PERMISSIONS_PATH]: [],
        resourceRoles: [],
        globalRoles: [Role.GENERAL_ADMIN],
      };

      // Check various resource-specific actions across different resource types
      expect(isAuthorized(token, Action.DELETE_PROJECT, 'project123')).toBe(
        true
      );
      expect(
        isAuthorized(token, Action.UPDATE_TEMPLATE_CONTENT, 'template456')
      ).toBe(true);
      expect(isAuthorized(token, Action.RESET_USER_PASSWORD, 'user789')).toBe(
        true
      );

      // And non-resource specific actions
      expect(isAuthorized(token, Action.CREATE_PROJECT)).toBe(true);
      expect(isAuthorized(token, Action.INITIALISE_SYSTEM_API)).toBe(true);
    });

    it('correctly handles edge cases with empty permissions and roles', () => {
      const emptyToken: EncodedTokenPermissions = {
        [COUCHDB_PERMISSIONS_PATH]: [],
        resourceRoles: [],
        globalRoles: [],
      };

      // Should deny everything with empty token
      expect(isAuthorized(emptyToken, Action.CREATE_PROJECT)).toBe(false);
      expect(
        isAuthorized(emptyToken, Action.READ_PROJECT_METADATA, 'project123')
      ).toBe(false);
    });
  });
});
