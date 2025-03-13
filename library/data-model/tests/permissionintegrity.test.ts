import {
  Resource,
  Action,
  Permission,
  Role,
  actionDetails,
  roleDetails,
  resourceToActions,
  permissionActions,
  actionPermissions,
  rolePermissions,
} from '../src/permission/index';

/**
 * Test suite for validating the permission model consistency
 */
describe('Permission Model Validation', () => {
  /**
   * Test that all resources have at least one action referring to them
   */
  describe('a) Resource-Action relationships', () => {
    it('should have at least one action for each resource', () => {
      // For each resource, check if there's at least one action that refers to it
      Object.values(Resource).forEach(resource => {
        const actionsForResource = Object.values(actionDetails).filter(
          details => details.resource === resource
        );

        expect(actionsForResource.length).toBeGreaterThan(0);
      });
    });

    it('should have correct resource to actions mapping', () => {
      // For each resource, manually calculate the actions and compare with resourceToActions
      Object.values(Resource).forEach(resource => {
        const expectedActions = Object.entries(actionDetails)
          .filter(([_, details]) => details.resource === resource)
          .map(([action]) => action as Action);

        expect(resourceToActions[resource].sort()).toEqual(
          expectedActions.sort()
        );
      });
    });
  });

  /**
   * Test that all actions have at least one permission granting them
   */
  describe('b) Action-Permission relationships', () => {
    it('should have at least one permission granting each action', () => {
      Object.values(Action).forEach(action => {
        if (typeof action === 'string') {
          const permissionsGrantingAction = actionPermissions[action];
          expect(permissionsGrantingAction.length).toBeGreaterThan(0);
        }
      });
    });
  });

  /**
   * Test that all actions and roles have complete descriptions
   */
  describe('c) Completeness of descriptions', () => {
    it('should have complete descriptions for all actions', () => {
      Object.values(Action).forEach(action => {
        if (typeof action === 'string') {
          const details = actionDetails[action];
          expect(details).toBeDefined();
          expect(details.name).toBeDefined();
          expect(details.description).toBeDefined();
          expect(details.resourceSpecific).toBeDefined();
          expect(details.resource).toBeDefined();
        }
      });
    });

    it('should have complete descriptions for all roles', () => {
      Object.values(Role).forEach(role => {
        if (typeof role === 'string') {
          const details = roleDetails[role];
          expect(details).toBeDefined();
          expect(details.name).toBeDefined();
          expect(details.description).toBeDefined();
          expect(details.scope).toBeDefined();
        }
      });
    });
  });

  /**
   * Test that the resource to actions map is correct
   */
  describe('d) Resource to Actions map validation', () => {
    it('should have consistent resource to actions mappings', () => {
      // For each resource
      Object.values(Resource).forEach(resource => {
        // Get all actions that should be associated with this resource
        const expectedActions = Object.entries(actionDetails)
          .filter(([_, details]) => details.resource === resource)
          .map(([action]) => action as Action);

        // Compare with what's in the resourceToActions map
        const actualActions = resourceToActions[resource];
        expect(actualActions.length).toBe(expectedActions.length);

        // Check that every expected action is in the actual actions list
        expectedActions.forEach(action => {
          expect(actualActions).toContain(action);
        });
      });
    });
  });

  /**
   * Test that all permissions are granted by at least one role
   */
  describe('e) Permission-Role relationships', () => {
    it('should have at least one role granting each permission', () => {
      const allGrantedPermissions = new Set<Permission>();

      // Collect all permissions granted by all roles
      Object.values(rolePermissions).forEach(({permissions}) => {
        permissions.forEach(permission => {
          allGrantedPermissions.add(permission);
        });
      });

      // Check that every permission is granted by at least one role
      Object.values(Permission).forEach(permission => {
        if (typeof permission === 'string') {
          console.log(permission);
          expect(allGrantedPermissions.has(permission)).toBe(true);
        }
      });
    });
  });

  /**
   * Test that all roles are described and there are no duplicate actions within permissions
   */
  describe('g) Role descriptions and permission action uniqueness', () => {
    it('should have all roles described in roleDetails', () => {
      Object.values(Role).forEach(role => {
        if (typeof role === 'string') {
          expect(roleDetails[role]).toBeDefined();
        }
      });
    });

    it('should not have duplicate actions within a single permission', () => {
      Object.values(Permission).forEach(permission => {
        if (typeof permission === 'string') {
          const {actions} = permissionActions[permission];
          const uniqueActions = new Set(actions);
          expect(uniqueActions.size).toBe(actions.length);
        }
      });
    });
  });

  /**
   * Test that permissions do not allow actions for resources they are not a part of
   */
  describe('h) Permission-Resource consistency', () => {
    it('should only allow actions for the correct resource', () => {
      Object.entries(permissionActions).forEach(
        ([permissionKey, {resource, actions}]) => {
          // For each action granted by this permission
          actions.forEach(action => {
            // The action should be for the same resource as the permission
            const actionResource = actionDetails[action].resource;
            expect(actionResource).toBe(resource);
          });
        }
      );
    });
  });

  /**
   * Test that the actionPermissions reverse map is correct
   */
  describe('i) Action to Permission reverse map validation', () => {
    it('should have a consistent action to permissions mapping', () => {
      // For each action
      Object.values(Action).forEach(action => {
        if (typeof action === 'string') {
          // Calculate the permissions that should grant this action
          const expectedPermissions = Object.entries(permissionActions)
            .filter(([_, {actions}]) => actions.includes(action))
            .map(([permission]) => permission as Permission);

          // Compare with the actionPermissions map
          const actualPermissions = actionPermissions[action];
          expect(actualPermissions.length).toBe(expectedPermissions.length);

          // Check that every expected permission is in the actual permissions list
          expectedPermissions.forEach(permission => {
            expect(actualPermissions).toContain(permission);
          });
        }
      });
    });
  });

  /**
   * Test that the rolePermissions does not have circular references in alsoGrants
   */
  describe('j) Role hierarchy circular reference check', () => {
    it('should not have circular references in role hierarchy', () => {
      // For each role
      Object.entries(rolePermissions).forEach(([roleKey, {alsoGrants}]) => {
        const role = roleKey as Role;
        if (alsoGrants && alsoGrants.length > 0) {
          // Check for direct circular references (role grants itself)
          expect(alsoGrants).not.toContain(role);

          // Check for indirect circular references
          const visited = new Set<Role>([role]);
          const checkCircular = (currentRole: Role): boolean => {
            const currentGrants = rolePermissions[currentRole].alsoGrants || [];

            for (const grantedRole of currentGrants) {
              if (visited.has(grantedRole)) {
                return true; // Found a circular reference
              }

              visited.add(grantedRole);
              if (checkCircular(grantedRole)) {
                return true;
              }
              visited.delete(grantedRole); // Backtrack
            }

            return false; // No circular reference found
          };

          expect(checkCircular(role)).toBe(false);
        }
      });
    });
  });

  /**
   * Additional test for overall consistency of the permission model
   */
  describe('Overall permission model consistency', () => {
    it('should have all enums properly defined without duplicates', () => {
      // Check for Resource enum
      const resourceValues = Object.values(Resource).filter(
        v => typeof v === 'string'
      );
      const uniqueResourceValues = new Set(resourceValues);
      expect(uniqueResourceValues.size).toBe(resourceValues.length);

      // Check for Action enum
      const actionValues = Object.values(Action).filter(
        v => typeof v === 'string'
      );
      const uniqueActionValues = new Set(actionValues);
      expect(uniqueActionValues.size).toBe(actionValues.length);

      // Check for Permission enum
      const permissionValues = Object.values(Permission).filter(
        v => typeof v === 'string'
      );
      const uniquePermissionValues = new Set(permissionValues);
      expect(uniquePermissionValues.size).toBe(permissionValues.length);

      // Check for Role enum
      const roleValues = Object.values(Role).filter(v => typeof v === 'string');
      const uniqueRoleValues = new Set(roleValues);
      expect(uniqueRoleValues.size).toBe(roleValues.length);
    });

    it('should have all action details mapped to valid resources', () => {
      Object.values(actionDetails).forEach(details => {
        expect(Object.values(Resource)).toContain(details.resource);
      });
    });

    it('should have all permission actions mapped to valid actions', () => {
      Object.values(permissionActions).forEach(({actions}) => {
        actions.forEach(action => {
          expect(actionDetails[action]).toBeDefined();
        });
      });
    });

    it('should have all role permissions mapped to valid permissions', () => {
      Object.values(rolePermissions).forEach(({permissions}) => {
        permissions.forEach(permission => {
          expect(permissionActions[permission]).toBeDefined();
        });
      });
    });
  });
});
