import {z} from 'zod';
import {
  APINotebookGetSchema,
  APINotebookListSchema,
  NotebookAuthSummarySchema,
  TemplateDocumentSchema,
  TemplateEditableDetailsSchema,
  UiSpecificationSchema,
} from './types';
import {Role} from './permission';
import {ExistingTeamsDBDocument} from './data_storage';

// ==================
// WIP USERS
// ==================

// Post update a user UpdateUser input
export const PostUpdateUserInputSchema = z.object({
  addrole: z.boolean(),
  role: z.nativeEnum(Role),
});
export type PostUpdateUserInput = z.infer<typeof PostUpdateUserInputSchema>;

// Optional redirect

export const OptionalRedirectQuery = z.object({
  redirect: z.string().optional(),
});

// Local login POST
// Body
export const PostLocalAuthInputSchema = z.object({
  username: z.string(),
  password: z.string().min(1),
});
// Query
export const PostLocalAuthQuerySchema = z.object({
  redirect: z.string().optional(),
});
export type PostLocalAuthQuery = z.infer<typeof PostLocalAuthQuerySchema>;
export type PostLocalAuthInput = z.infer<typeof PostLocalAuthInputSchema>;

// Register by invite ID
// Body
export const GetRegisterByInviteQuerySchema = OptionalRedirectQuery;
export type GetRegisterByInviteQuery = z.infer<
  typeof GetRegisterByInviteQuerySchema
>;

// Local register
export const PostRegisterLocalInputSchema = z.object({
  // Username optional - email used if not provided
  username: z
    .string()
    .trim()
    .min(5, 'Must provide a username of at least length 5.')
    .optional(),
  password: z.string().trim(),
  email: z
    .string()
    .trim()
    .email(
      'Email provided during user registration is not a valid email address.'
    ),
  repeat: z.string(),
  name: z.string(),
  redirect: z.string().trim().optional(),
});
export const PostRegisterLocalQuerySchema = OptionalRedirectQuery;
export type PostRegisterLocalInput = z.infer<
  typeof PostRegisterLocalInputSchema
>;
export type PostRegisterLocalQuery = z.infer<
  typeof PostRegisterLocalQuerySchema
>;

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

// ==================
// WIP NOTEBOOKS CRUD
// ==================

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
  'ui-specification': UiSpecificationSchema,
  metadata: z.record(z.any()),
});
export type NotebookEditableDetails = z.infer<
  typeof NotebookEditableDetailsSchema
>;

export const CreateNotebookFromTemplateSchema = z.object({
  // Prefer project_name for APIs but keeping alignment with existing endpoint
  name: z.string(),
  template_id: z.string(),
});
export type CreateNotebookFromTemplate = z.infer<
  typeof CreateNotebookFromTemplateSchema
>;

export const CreateNotebookFromScratchSchema =
  NotebookEditableDetailsSchema.extend({
    name: z.string(),
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

// POST create new template input
export const PostCreateTemplateInputSchema = TemplateEditableDetailsSchema;
export type PostCreateTemplateInput = z.infer<
  typeof PostCreateTemplateInputSchema
>;
// POST create new template response
export const PostCreateTemplateResponseSchema = TemplateDocumentSchema;
export type PostCreateTemplateResponse = z.infer<
  typeof PostCreateTemplateResponseSchema
>;

// PUT update existing template input
export const PutUpdateTemplateInputSchema = TemplateEditableDetailsSchema;
export type PutUpdateTemplateInput = z.infer<
  typeof PutUpdateTemplateInputSchema
>;
// PUT update existing template response
export const PutUpdateTemplateResponseSchema = TemplateDocumentSchema;
export type PutUpdateTemplateResponse = z.infer<
  typeof PutUpdateTemplateResponseSchema
>;

// GET list all templates response
export const GetListTemplatesResponseSchema = z.object({
  templates: z.array(TemplateDocumentSchema),
});
export type GetListTemplatesResponse = z.infer<
  typeof GetListTemplatesResponseSchema
>;

// GET a specific template by _id response
export const GetTemplateByIdResponseSchema = TemplateDocumentSchema;
export type GetTemplateByIdResponse = z.infer<
  typeof GetTemplateByIdResponseSchema
>;

// EMAIL RESET

// POST /reset request schema
export const PostRequestPasswordResetRequestSchema = z.object({
  email: z.string(),
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
export const TeamMembershipInputSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  role: z.nativeEnum(Role, {
    errorMap: () => ({message: 'Must be a valid role'}),
  }),
  add: z.boolean(),
});

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
