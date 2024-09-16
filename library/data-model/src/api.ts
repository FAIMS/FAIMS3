import { z } from 'zod';
import { ADMIN_GROUP_NAMES_SCHEMA } from './auth';
import {
    APINotebookGetSchema,
    APINotebookListSchema,
    NotebookAuthSummarySchema,
    ProjectUIModel,
    TemplateDocumentSchema,
    TemplateEditableDetailsSchema,
} from './types';

// ==================
// WIP USERS
// ==================

// Post update a user UpdateUser input
export const PostUpdateUserInputSchema = z.object({
  addrole: z.boolean(),
  role: ADMIN_GROUP_NAMES_SCHEMA,
});
export type PostUpdateUserInput = z.infer<typeof PostUpdateUserInputSchema>;

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
  'ui-specification': z.custom<ProjectUIModel>(),
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
  // The role to add (must be valid in project metadata)
  role: z.string(),
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
