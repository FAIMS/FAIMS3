import {z} from 'zod';
import {
  APINotebookGetSchema,
  APINotebookListSchema,
  ProjectUIModel,
  TemplateDocumentSchema,
  TemplateEditableDetailsSchema,
} from './types';

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

export const CreateNotebookFromTemplateSchema = z.object({
  // Prefer project_name for APIs but keeping alignment with existing endpoint
  name: z.string(),
  template_id: z.string(),
});
export type CreateNotebookFromTemplate = z.infer<
  typeof CreateNotebookFromTemplateSchema
>;

export const CreateNotebookFromScratchSchema = z.object({
  name: z.string(),
  // This allows you to type hint as an interface but won't parse/validate it
  // TODO convert these models into their zod counterparts
  'ui-specification': z.custom<ProjectUIModel>(),
  metadata: z.record(z.any()),
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