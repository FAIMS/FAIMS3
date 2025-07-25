import {z} from 'zod';
import {PeopleDBDocumentSchema, ProjectStatus} from './data_storage';
import {
  ExistingTemplateDocumentSchema,
  TemplateDBFieldsSchema,
} from './data_storage/templatesDB/types';
import {Resource, Role} from './permission/model';
import {EncodedUISpecificationSchema} from './types';

// ==================
// WIP USERS
// ==================

// logout
export const PutLogoutInputSchema = z.object({refreshToken: z.string()});
export type PutLogoutInput = z.infer<typeof PutLogoutInputSchema>;

// Change Password
export const PostChangePasswordInputSchema = z
  .object({
    username: z.string().trim(),
    currentPassword: z.string().trim(),
    newPassword: z
      .string()
      .trim()
      .min(10, 'New password must be at least 10 characters in length.'),
    confirmPassword: z.string().trim(),
    redirect: z.string().trim().optional(),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: 'New passwords do not match',
    path: ['confirmPassword'],
  });

export type PostChangePasswordInput = z.infer<
  typeof PostChangePasswordInputSchema
>;

// Forgot password
export const PostForgotPasswordInputSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.'),
  redirect: z.string().trim().optional(),
});

export type PostForgotPasswordInput = z.infer<
  typeof PostForgotPasswordInputSchema
>;

// Reset Password
export const PostResetPasswordInputSchema = z
  .object({
    code: z.string().trim(),
    newPassword: z
      .string()
      .trim()
      .min(10, 'Password must be at least 10 characters in length.'),
    confirmPassword: z.string().trim(),
    redirect: z.string().trim().optional(),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type PostResetPasswordInput = z.infer<
  typeof PostResetPasswordInputSchema
>;

// Get current user
export const GetCurrentUserResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  isVerified: z.boolean(),
});

export type GetCurrentUserResponse = z.infer<
  typeof GetCurrentUserResponseSchema
>;

export const GetListAllUsersResponseSchema = z.array(
  // Be careful here - do NOT expose any salt info etc
  PeopleDBDocumentSchema.pick({
    _id: true,
    emails: true,
    globalRoles: true,
    projectRoles: true,
    teamRoles: true,
    templateRoles: true,
    name: true,
    user_id: true,
  })
    // configure to strip not fail for extra fields
    .strip()
);
export type GetListAllUsersResponse = z.infer<
  typeof GetListAllUsersResponseSchema
>;

// Information about users and roles for a notebook
export const NotebookAuthSummarySchema = z.object({
  // What roles does the notebook have
  roles: z.array(z.nativeEnum(Role)),
  // users permissions for this notebook
  users: z.array(
    z.object({
      name: z.string(),
      username: z.string(),
      roles: z.array(
        z.object({
          name: z.nativeEnum(Role),
          value: z.boolean(),
        })
      ),
    })
  ),
});
export type NotebookAuthSummary = z.infer<typeof NotebookAuthSummarySchema>;

// Post update a user UpdateUser input
export const PostUpdateUserInputSchema = z.object({
  addrole: z.boolean(),
  role: z.nativeEnum(Role),
});
export type PostUpdateUserInput = z.infer<typeof PostUpdateUserInputSchema>;

export const UpdateUserProjectRoleInputSchema = z.object({
  action: z.enum(['add', 'remove']),
  role: z.enum(['user', 'team', 'moderator', 'admin']),
});
export type UpdateUserProjectRoleInput = z.infer<
  typeof UpdateUserProjectRoleInputSchema
>;

// Local login POST
// Body
// This is used in many places to 'contextualise' the auth action
export const AuthContextSchema = z.object({
  // what action are we taking?
  action: z.enum(['register', 'login']),
  // Do we we want to redirect back somewhere once finished?
  redirect: z.string().trim().optional(),
  // What is the invite ID (required if action is register)
  inviteId: z.string().trim().optional(),
});
export type AuthContext = z.infer<typeof AuthContextSchema>;

export const PostLoginInputSchema = AuthContextSchema.extend({
  email: z.string().trim(),
  password: z.string().trim().min(1),
});
export type PostLoginInput = z.infer<typeof PostLoginInputSchema>;
export const PostRegisterInputSchema = AuthContextSchema.extend({
  // Baseline email and password (always required)
  email: z.string().trim().email('Email address must be a valid email.'),
  password: z
    .string()
    .trim()
    .min(10, 'Password must be of at least 10 characters in length.'),
  repeat: z.string(),
  name: z
    .string()
    .trim()
    .min(5, 'Name must be of at least 5 characters in length.'),
});
export type PostRegisterInput = z.infer<typeof PostRegisterInputSchema>;

export const PostRefreshTokenInputSchema = z.object({
  refreshToken: z.string(),
});
export type PostRefreshTokenInput = z.infer<typeof PostRefreshTokenInputSchema>;
export const PostRefreshTokenResponseSchema = z.object({
  // fresh JWT
  token: z.string(),
});
export type PostRefreshTokenResponse = z.infer<
  typeof PostRefreshTokenResponseSchema
>;

// Token exchange
export const PostExchangeTokenInputSchema = z.object({
  exchangeToken: z.string().min(1),
});
export type PostExchangeTokenInput = z.infer<
  typeof PostExchangeTokenInputSchema
>;
export const PostExchangeTokenResponseSchema = z.object({
  // token pair
  refreshToken: z.string(),
  accessToken: z.string(),
});
export type PostExchangeTokenResponse = z.infer<
  typeof PostExchangeTokenResponseSchema
>;

// ==================
// WIP NOTEBOOKS CRUD
// ==================

// TODO make this better, currently there is no real explanation for this
// structure

// This is returned from the list project endpoints
export const APINotebookListSchema = z.object({
  name: z.string(),
  is_admin: z.boolean(),
  last_updated: z.string().optional(),
  created: z.string().optional(),
  template_id: z.string().optional(),
  project_id: z.string(),
  metadata: z.record(z.unknown()).optional().nullable(),
  ownedByTeamId: z.string().min(1).optional(),
  status: z.nativeEnum(ProjectStatus),
});
export type APINotebookList = z.infer<typeof APINotebookListSchema>;

// This is returned from the get project endpoint
export const APINotebookGetSchema = z.object({
  // metadata and spec to match notebook json schema
  metadata: z.record(z.unknown()),
  'ui-specification': z.record(z.unknown()),
  ownedByTeamId: z.string().min(1).optional(),
  status: z.nativeEnum(ProjectStatus),
  // Name of the notebook!
  name: z.string(),
  // optional count of number of records
  recordCount: z.number().optional(),
});
export type APINotebookGet = z.infer<typeof APINotebookGetSchema>;

// GET notebook by ID
export const GetNotebookResponseSchema = APINotebookGetSchema;
export type GetNotebookResponse = z.infer<typeof GetNotebookResponseSchema>;

// GET notebook list
export const GetNotebookListResponseSchema = z.array(APINotebookListSchema);
export type GetNotebookListResponse = z.infer<
  typeof GetNotebookListResponseSchema
>;

// Base editable details class for notebooks
export const NotebookEditableDetailsSchema = z.object({
  // This allows you to type hint as an interface but won't parse/validate it
  // TODO convert these models into their zod counterparts
  'ui-specification': EncodedUISpecificationSchema,
  metadata: z.record(z.any()),
});
export type NotebookEditableDetails = z.infer<
  typeof NotebookEditableDetailsSchema
>;

export const CreateNotebookFromTemplateSchema = z.object({
  // Prefer project_name for APIs but keeping alignment with existing endpoint
  name: z.string(),
  template_id: z.string(),
  teamId: z.string().min(1).optional(),
});
export type CreateNotebookFromTemplate = z.infer<
  typeof CreateNotebookFromTemplateSchema
>;

export const CreateNotebookFromScratchSchema =
  NotebookEditableDetailsSchema.extend({
    name: z.string(),
    teamId: z.string().min(1).optional(),
  });
export type CreateNotebookFromScratch = z.infer<
  typeof CreateNotebookFromScratchSchema
>;

// POST create new notebook from template input
export const PostCreateNotebookInputSchema = z.union([
  CreateNotebookFromScratchSchema,
  CreateNotebookFromTemplateSchema,
]);
export type PostCreateNotebookInput = z.infer<
  typeof PostCreateNotebookInputSchema
>;

// PUT :/id change project status
export const PutChangeNotebookStatusInputSchema = z.object({
  status: z.nativeEnum(ProjectStatus),
});

export type PutChangeNotebookStatusInput = z.infer<
  typeof PutChangeNotebookStatusInputSchema
>;

// PUT :/id change project team
export const PutChangeNotebookTeamInputSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
});

export type PutChangeNotebookTeamInput = z.infer<
  typeof PutChangeNotebookTeamInputSchema
>;

// POST create new notebook from template response
export const PostCreateNotebookResponseSchema = z.object({
  notebook: z.string(),
});
export type PostCreateNotebookResponse = z.infer<
  typeof PostCreateNotebookResponseSchema
>;

// GET users for a notebook - no input
export const GetNotebookUsersResponseSchema = NotebookAuthSummarySchema;
export type GetNotebookUsersResponse = z.infer<
  typeof GetNotebookUsersResponseSchema
>;

// PUT update existing notebook input
export const PutUpdateNotebookInputSchema = NotebookEditableDetailsSchema;
export type PutUpdateNotebookInput = z.infer<
  typeof PutUpdateNotebookInputSchema
>;

// PUT update existing template response
export const PutUpdateNotebookResponseSchema = z.object({
  // notebook/project ID
  notebook: z.string(),
});
export type PutUpdateNotebookResponse = z.infer<
  typeof PutUpdateNotebookResponseSchema
>;

// POST modify user for notebook
export const PostAddNotebookUserInputSchema = z.object({
  // The username to add to the notebook roles
  username: z.string(),
  // The role to add
  role: z.nativeEnum(Role),
  // Addrole:= true means add, false means remove
  addrole: z.boolean(),
});

export type PostAddNotebookUserInput = z.infer<
  typeof PostAddNotebookUserInputSchema
>;

// POST check record sync status
export const PostRecordStatusInputSchema = z.object({
  // a map from record ids to hashes
  record_map: z.record(z.string(), z.string()),
});
export type PostRecordStatusInput = z.infer<typeof PostRecordStatusInputSchema>;

export const PostRecordStatusResponseSchema = z.object({
  status: z.record(z.string(), z.boolean()),
});
export type PostRecordStatusResponse = z.infer<
  typeof PostRecordStatusResponseSchema
>;

// Post generate random records RandomRecords input
export const PostRandomRecordsInputSchema = z.object({count: z.number()});
export type PostRandomRecordsInput = z.infer<
  typeof PostRandomRecordsInputSchema
>;

// Post generate random records RandomRecords response
export const PostRandomRecordsResponseSchema = z.object({
  // Ids of new records
  record_ids: z.array(z.string()),
});
export type PostRandomRecordsResponse = z.infer<
  typeof PostRandomRecordsResponseSchema
>;

// =================
// TEMPLATES CRUD
// =================

// POST create new template
export const PostCreateTemplateInputSchema = TemplateDBFieldsSchema.pick({
  metadata: true,
  'ui-specification': true,
  name: true,
}).extend({
  // prefer to use a nicer team ID input field
  teamId: z.string().trim().min(1).optional(),
});
export type PostCreateTemplateInput = z.infer<
  typeof PostCreateTemplateInputSchema
>;
export const PostCreateTemplateResponseSchema = ExistingTemplateDocumentSchema;
export type PostCreateTemplateResponse = z.infer<
  typeof PostCreateTemplateResponseSchema
>;

// PUT update existing template input
export const PutUpdateTemplateInputSchema = TemplateDBFieldsSchema.pick({
  metadata: true,
  'ui-specification': true,
});
export type PutUpdateTemplateInput = z.infer<
  typeof PutUpdateTemplateInputSchema
>;
export const PutUpdateTemplateResponseSchema = ExistingTemplateDocumentSchema;
export type PutUpdateTemplateResponse = z.infer<
  typeof PutUpdateTemplateResponseSchema
>;

// GET list all templates response
export const GetListTemplatesResponseSchema = z.object({
  templates: z.array(ExistingTemplateDocumentSchema),
});
export type GetListTemplatesResponse = z.infer<
  typeof GetListTemplatesResponseSchema
>;

// GET a specific template by _id response
export const GetTemplateByIdResponseSchema = ExistingTemplateDocumentSchema;
export type GetTemplateByIdResponse = z.infer<
  typeof GetTemplateByIdResponseSchema
>;

// EMAIL RESET

// POST /reset request schema
export const PostRequestPasswordResetRequestSchema = z.object({
  email: z.string(),
  redirect: z.string().optional(),
});
export type PostRequestPasswordResetRequest = z.infer<
  typeof PostRequestPasswordResetRequestSchema
>;

// POST /reset response schema
export const PostRequestPasswordResetResponseSchema = z.object({
  // The reset code
  code: z.string(),
  // The URL which embeds this code in the proper format
  url: z.string(),
});
export type PostRequestPasswordResetResponse = z.infer<
  typeof PostRequestPasswordResetResponseSchema
>;

// PUT /reset request schema
export const PutRequestPasswordResetRequestSchema = z.object({
  code: z.string(),
  newPassword: z.string().min(10),
});
export type PutRequestPasswordResetRequest = z.infer<
  typeof PutRequestPasswordResetRequestSchema
>;

// PUT /reset response schema
export const PutRequestPasswordResetResponseSchema = z.object({
  message: z.string(),
});
export type PutRequestPasswordResetResponse = z.infer<
  typeof PutRequestPasswordResetResponseSchema
>;

// TEAMS
// =====

/**
 * Schema for creating a new team
 */
export const PostCreateTeamInputSchema = z.object({
  name: z.string().min(5, 'Team name is required, minimum length 5.'),
  description: z.string(),
});

/**
 * Schema for updating an existing team
 */
export const PutUpdateTeamInputSchema = z.object({
  name: z
    .string()
    .min(5, 'Team name is required, minimum length 5.')
    .optional(),
  description: z.string().optional(),
});

/**
 * Basic team document schema
 */
export const TeamDocumentSchema = z.object({
  _id: z.string(),
  _rev: z.string(),
  name: z.string(),
  description: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  createdBy: z.string(),
});

/**
 * GET /api/teams response
 */
export const GetListTeamsResponseSchema = z.object({
  teams: z.array(TeamDocumentSchema),
});

/**
 * GET /api/teams/:id response
 */
export const GetTeamByIdResponseSchema = TeamDocumentSchema;

/**
 * POST /api/teams response
 */
export const PostCreateTeamResponseSchema = TeamDocumentSchema;

/**
 * PUT /api/teams/:id response
 */
export const PutUpdateTeamResponseSchema = TeamDocumentSchema;

// inferred types
export type PostCreateTeamInput = z.infer<typeof PostCreateTeamInputSchema>;
export type PutUpdateTeamInput = z.infer<typeof PutUpdateTeamInputSchema>;
export type GetListTeamsResponse = z.infer<typeof GetListTeamsResponseSchema>;
export type GetTeamByIdResponse = z.infer<typeof GetTeamByIdResponseSchema>;
export type PostCreateTeamResponse = z.infer<
  typeof PostCreateTeamResponseSchema
>;
export type PutUpdateTeamResponse = z.infer<typeof PutUpdateTeamResponseSchema>;

/**
 * Schema for managing team membership
 */
export const TeamMembershipInputSchema = z
  .object({
    username: z.string().min(1, 'Username is required'),
    role: z
      .nativeEnum(Role, {
        errorMap: () => ({message: 'Must be a valid role'}),
      })
      .optional(),
    action: z.enum(['ADD_ROLE', 'REMOVE_ROLE', 'REMOVE_USER']),
  })
  .refine(
    // Cannot remove and include role
    ({action, role}) => !(action === 'REMOVE_USER' && !!role),
    {
      message:
        'Invalid payload. You cannot specify a role when removing a user.',
      path: ['role', 'action'],
    }
  )
  .refine(
    ({action, role}) =>
      !((action === 'ADD_ROLE' || action === 'REMOVE_ROLE') && !role),
    {
      message: 'Must specify a role if removing or adding a role to the user.',
      path: ['role', 'action'],
    }
  );

/**
 * Team member role schema
 */
export const TeamMemberRoleSchema = z.object({
  role: z.nativeEnum(Role),
  hasRole: z.boolean(),
});

/**
 * Team member info schema
 */
export const TeamMemberInfoSchema = z.object({
  username: z.string(),
  name: z.string(),
  roles: z.array(TeamMemberRoleSchema),
});

/**
 * Available role info schema
 */
export const AvailableRoleInfoSchema = z.object({
  role: z.nativeEnum(Role),
  name: z.string(),
  description: z.string(),
});

/**
 * GET /api/teams/:id/members response
 */
export const GetTeamMembersResponseSchema = z.object({
  members: z.array(TeamMemberInfoSchema),
  availableRoles: z.array(AvailableRoleInfoSchema),
});

export type TeamMembershipInput = z.infer<typeof TeamMembershipInputSchema>;
export type TeamMemberRole = z.infer<typeof TeamMemberRoleSchema>;
export type TeamMemberInfo = z.infer<typeof TeamMemberInfoSchema>;
export type AvailableRoleInfo = z.infer<typeof AvailableRoleInfoSchema>;
export type GetTeamMembersResponse = z.infer<
  typeof GetTeamMembersResponseSchema
>;

// INVITES
// =======

/**
 * Schema for creating a project invite
 */
export const PostCreateInviteInputSchema = z.object({
  role: z.nativeEnum(Role),
  name: z.string().min(1, 'Invite name is required'),
  uses: z.number().min(1, 'Uses must be at least 1').optional(),
  expiry: z.number().optional(),
});

/**
 * Basic invite response schema
 */
export const InviteInfoResponseSchema = z.object({
  id: z.string(),
  resourceType: z.enum([Resource.PROJECT, Resource.TEAM]),
  resourceId: z.string(),
  name: z.string(),
  role: z.nativeEnum(Role),
  createdAt: z.number(),
  expiry: z.number().optional(),
  isValid: z.boolean(),
  invalidReason: z.string().optional(),
  usesRemaining: z.number().optional(),
});

/**
 * Full invite document schema (internal)
 */
export const InviteDocumentSchema = z.object({
  _id: z.string(),
  _rev: z.string(),
  resourceType: z.enum([Resource.PROJECT, Resource.TEAM]),
  resourceId: z.string(),
  name: z.string(),
  role: z.nativeEnum(Role),
  createdBy: z.string(),
  createdAt: z.number(),
  expiry: z.number(),
  usesOriginal: z.number().optional(),
  usesConsumed: z.number(),
  uses: z.array(
    z.object({
      userId: z.string(),
      usedAt: z.number(),
    })
  ),
});

/**
 * GET /api/invites/:inviteId response
 */
export const GetInviteByIdResponseSchema = InviteInfoResponseSchema;

/**
 * GET /api/invites/project/:projectId response
 */
export const GetProjectInvitesResponseSchema = z.array(InviteDocumentSchema);

/**
 * GET /api/invites/team/:teamId response
 */
export const GetTeamInvitesResponseSchema = z.array(InviteDocumentSchema);

/**
 * POST /api/invites/project/:projectId response
 */
export const PostCreateProjectInviteResponseSchema = InviteDocumentSchema;

/**
 * POST /api/invites/team/:teamId response
 */
export const PostCreateTeamInviteResponseSchema = InviteDocumentSchema;

/**
 * POST /api/invites/:inviteId/use response
 */
export const PostUseInviteResponseSchema = z.object({
  success: z.boolean(),
  resourceType: z.enum([Resource.PROJECT, Resource.TEAM]),
  resourceId: z.string(),
  role: z.nativeEnum(Role),
});

// inferred types
export type PostCreateInviteInput = z.infer<typeof PostCreateInviteInputSchema>;
export type InviteInfoResponse = z.infer<typeof InviteInfoResponseSchema>;
export type InviteDocument = z.infer<typeof InviteDocumentSchema>;
export type GetInviteByIdResponse = z.infer<typeof GetInviteByIdResponseSchema>;
export type GetProjectInvitesResponse = z.infer<
  typeof GetProjectInvitesResponseSchema
>;
export type GetTeamInvitesResponse = z.infer<
  typeof GetTeamInvitesResponseSchema
>;
export type PostCreateProjectInviteResponse = z.infer<
  typeof PostCreateProjectInviteResponseSchema
>;
export type PostCreateTeamInviteResponse = z.infer<
  typeof PostCreateTeamInviteResponseSchema
>;
export type PostUseInviteResponse = z.infer<typeof PostUseInviteResponseSchema>;

// EMAIL VERIFICATION

// POST /verify request schema
export const PostRequestEmailVerificationRequestSchema = z.object({
  email: z.string().email('Must be a valid email address'),
});
export type PostRequestEmailVerificationRequest = z.infer<
  typeof PostRequestEmailVerificationRequestSchema
>;

// POST /verify response schema
export const PostRequestEmailVerificationResponseSchema = z.object({
  message: z.string(),
  email: z.string().email(),
  expiresAt: z.number().optional(),
});
export type PostRequestEmailVerificationResponse = z.infer<
  typeof PostRequestEmailVerificationResponseSchema
>;

// PUT /verify request schema
export const PutConfirmEmailVerificationRequestSchema = z.object({
  code: z.string(),
});
export type PutConfirmEmailVerificationRequest = z.infer<
  typeof PutConfirmEmailVerificationRequestSchema
>;

// PUT /verify response schema
export const PutConfirmEmailVerificationResponseSchema = z.object({
  message: z.string(),
  email: z.string().email(),
});
export type PutConfirmEmailVerificationResponse = z.infer<
  typeof PutConfirmEmailVerificationResponseSchema
>;

// ============================
// LONG LIVED TOKENS API ROUTES
// ============================

// Request Schemas
export const PostCreateLongLivedTokenRequestSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  expiryTimestampMs: z.number().int().positive().optional(),
});

export const PutUpdateLongLivedTokenRequestSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(500).optional(),
});

export const PutRevokeLongLivedTokenRequestSchema = z.object({
  // Empty body for revoke operation
});

// Response Schemas
export const LongLivedTokenResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
  expiresAt: z.number().optional(),
  lastUsedAt: z.number().optional(),
  userId: z.string(),
});

export const PostCreateLongLivedTokenResponseSchema =
  LongLivedTokenResponseSchema.extend({
    token: z.string(), // Only included on creation
  });

export const PutUpdateLongLivedTokenResponseSchema =
  LongLivedTokenResponseSchema;

export const PutRevokeLongLivedTokenResponseSchema =
  LongLivedTokenResponseSchema.extend({
    message: z.string(),
  });

export const GetLongLivedTokensResponseSchema = z.object({
  tokens: z.array(LongLivedTokenResponseSchema),
  maxAllowedExpiryTimestamp: z.number().optional(),
  maxDurationDays: z.number().optional(),
});

export const PostLongLivedTokenExchangeInputSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const PostLongLivedTokenExchangeResponseSchema = z.object({
  token: z.string(),
});

// Type exports
export type PostCreateLongLivedTokenRequest = z.infer<
  typeof PostCreateLongLivedTokenRequestSchema
>;
export type PostCreateLongLivedTokenResponse = z.infer<
  typeof PostCreateLongLivedTokenResponseSchema
>;
export type PutUpdateLongLivedTokenRequest = z.infer<
  typeof PutUpdateLongLivedTokenRequestSchema
>;
export type PutUpdateLongLivedTokenResponse = z.infer<
  typeof PutUpdateLongLivedTokenResponseSchema
>;
export type PutRevokeLongLivedTokenRequest = z.infer<
  typeof PutRevokeLongLivedTokenRequestSchema
>;
export type PutRevokeLongLivedTokenResponse = z.infer<
  typeof PutRevokeLongLivedTokenResponseSchema
>;
export type GetLongLivedTokensResponse = z.infer<
  typeof GetLongLivedTokensResponseSchema
>;

export type PostLongLivedTokenExchangeInput = z.infer<
  typeof PostLongLivedTokenExchangeInputSchema
>;
export type PostLongLivedTokenExchangeResponse = z.infer<
  typeof PostLongLivedTokenExchangeResponseSchema
>;
