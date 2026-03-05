// Types related to authentication and user provisioning.

import z from 'zod';

// Policies for provisioning users who login via SSO but don't yet
// have an account.
// own-team - creates a team for the user and assigns them as admin of that team
// general-user - creates a general user account for them
// reject - rejects the login attempt

const ProvisionSSOUsersPolicySchema = z.enum([
  'own-team',
  'general-user',
  'reject',
]);

export type ProvisionSSOUsersPolicy = z.infer<
  typeof ProvisionSSOUsersPolicySchema
>;
