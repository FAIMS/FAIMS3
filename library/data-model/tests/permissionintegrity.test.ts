import {
  Action,
  Resource,
  Role,
  actionDetails,
  actionRoles,
  getAllActionsForRole,
  resourceToActions,
  roleActions,
  roleDetails,
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
   * Test that all actions have at least one role granting them
   */
  describe('b) Action-Role relationships', () => {
    it('should have at least one role granting each action', () => {
      Object.values(Action).forEach(action => {
        if (typeof action === 'string') {
          const rolesGrantingAction = actionRoles[action];
          expect(rolesGrantingAction.length).toBeGreaterThan(0);
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

  describe('e) Action-Role relationships', () => {
    it('should have at least one role granting each action', () => {
      const allGrantedActions = new Set<Action>();

      // Collect all actions granted by all roles (including inherited)
      Object.keys(roleActions).forEach(roleKey => {
        const role = roleKey as Role;
        getAllActionsForRole(role).forEach(action => {
          allGrantedActions.add(action);
        });
      });

      // Find any unmapped actions
      const unmappedActions: Action[] = [];
      Object.values(Action).forEach(action => {
        if (
          typeof action === 'string' &&
          !allGrantedActions.has(action as Action)
        ) {
          unmappedActions.push(action as Action);
        }
      });

      // Better failure message showing exactly which actions are unmapped
      if (unmappedActions.length > 0) {
        console.error(
          `The following actions are not mapped to any role: ${unmappedActions.join(', ')}`
        );
      }

      // Make sure every action is granted by at least one role
      expect(unmappedActions.length).toBe(0);
    });

    it('should show which roles grant each action', () => {
      // Create a mapping of actions to the roles that grant them
      const actionToRoles = {} as Record<Action, Role[]>;

      Object.values(Action).forEach(action => {
        if (typeof action === 'string') {
          actionToRoles[action as Action] = [];
        }
      });

      // Fill in the roles for each action
      Object.keys(roleActions).forEach(roleKey => {
        const role = roleKey as Role;
        getAllActionsForRole(role).forEach(action => {
          if (!actionToRoles[action].includes(role)) {
            actionToRoles[action].push(role);
          }
        });
      });

      // Log out actions with no roles for easier debugging
      Object.entries(actionToRoles).forEach(([action, roles]) => {
        if (roles.length === 0) {
          console.log(`ACTION WITH NO ROLES: ${action}`);
        }
      });

      // Check each action has at least one role
      Object.entries(actionToRoles).forEach(([action, roles]) => {
        if (roles.length < 1) {
          console.log(`Action ${action} is not mapped to any role`);
        }
        expect(roles.length).toBeGreaterThan(0);
      });
    });
  });

  /**
   * Test that all roles are described
   */
  describe('g) Role descriptions and action uniqueness', () => {
    it('should have all roles described in roleDetails', () => {
      Object.values(Role).forEach(role => {
        if (typeof role === 'string') {
          expect(roleDetails[role]).toBeDefined();
        }
      });
    });

    it('should not have duplicate actions within a single role', () => {
      Object.values(Role).forEach(role => {
        if (typeof role === 'string') {
          const {actions} = roleActions[role];
          const uniqueActions = new Set(actions);
          expect(uniqueActions.size).toBe(actions.length);
        }
      });
    });
  });

  /**
   * Test that roles do not allow actions for resources they should not have access to
   */
  describe('h) Role-Resource consistency', () => {
    it('should only allow actions for the correct resource type for resource-specific roles', () => {
      Object.entries(roleDetails).forEach(([roleKey, details]) => {
        // Only check resource-specific roles
        if (details.resource) {
          const role = roleKey as Role;
          const roleResource = details.resource;

          // Get all direct actions this role grants
          const directActions = roleActions[role].actions;

          // Each action should be for the same resource type
          directActions.forEach(action => {
            const actionResource = actionDetails[action].resource;
            expect(actionResource).toBe(roleResource);
          });
        }
      });
    });
  });

  /**
   * Test that the actionRoles reverse map is correct
   */
  describe('i) Action to Role reverse map validation', () => {
    it('should have a consistent action to roles mapping', () => {
      // For each action
      Object.values(Action).forEach(action => {
        if (typeof action === 'string') {
          // Calculate the roles that should grant this action (directly)
          const expectedRoles = Object.entries(roleActions)
            .filter(([_, {actions}]) => actions.includes(action))
            .map(([role]) => role as Role);

          // Get the actual roles that directly grant this action
          const actualRoles = actionRoles[action].filter(role =>
            roleActions[role].actions.includes(action)
          );

          // Check that every expected role is in the actual roles list
          expectedRoles.forEach(role => {
            expect(actualRoles).toContain(role);
          });
        }
      });
    });
  });

  /**
   * Test that the roleActions does not have circular references in inheritedRoles
   */
  describe('j) Role hierarchy circular reference check', () => {
    it('should not have circular references in role hierarchy', () => {
      // For each role
      Object.entries(roleActions).forEach(([roleKey, {inheritedRoles}]) => {
        const role = roleKey as Role;
        if (inheritedRoles && inheritedRoles.length > 0) {
          // Check for direct circular references (role inherits itself)
          expect(inheritedRoles).not.toContain(role);

          // Check for indirect circular references
          const visited = new Set<Role>([role]);
          const checkCircular = (currentRole: Role): boolean => {
            const currentInherits =
              roleActions[currentRole].inheritedRoles || [];

            for (const inheritedRole of currentInherits) {
              if (visited.has(inheritedRole)) {
                return true; // Found a circular reference
              }

              visited.add(inheritedRole);
              if (checkCircular(inheritedRole)) {
                return true;
              }
              visited.delete(inheritedRole); // Backtrack
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

    it('should have all role actions mapped to valid actions', () => {
      Object.values(roleActions).forEach(({actions}) => {
        actions.forEach(action => {
          expect(actionDetails[action]).toBeDefined();
        });
      });
    });

    it('should have all role inheritances mapped to valid roles', () => {
      Object.values(roleActions).forEach(({inheritedRoles}) => {
        if (inheritedRoles) {
          inheritedRoles.forEach(role => {
            expect(roleDetails[role]).toBeDefined();
          });
        }
      });
    });
  });
});
