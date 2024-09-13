import {z} from 'zod';
import {
  APINotebookGetSchema,
  APINotebookListSchema,
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

// POST create new notebook from template input
export const PostCreateNotebookFromTemplateSchema = z.object({
  template_id: z.string(),
  project_name: z.string(),
});
export type PostCreateNotebookFromTemplate = z.infer<
  typeof PostCreateNotebookFromTemplateSchema
>;
// POST create new notebook from template response
export const PostCreateNotebookFromTemplateResponseSchema = z.object({
  notebook: z.string(),
});
export type PostCreateNotebookFromTemplateResponse = z.infer<
  typeof PostCreateNotebookFromTemplateResponseSchema
>;
