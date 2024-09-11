import {z} from 'zod';
import {TemplateDocumentSchema, TemplateEditableDetailsSchema} from './types';

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
export const PostUpdateTemplateInputSchema = TemplateEditableDetailsSchema;
export type PostUpdateTemplateInput = z.infer<
  typeof PostUpdateTemplateInputSchema
>;
// PUT update existing template response
export const PostUpdateTemplateResponseSchema = TemplateDocumentSchema;
export type PostUpdateTemplateResponse = z.infer<
  typeof PostUpdateTemplateResponseSchema
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
