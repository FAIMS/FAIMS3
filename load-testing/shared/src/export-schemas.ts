import {z} from 'zod';

/** Matches @faims3/data-model GetExportNotebookResponseSchema (kept local for Node ESM agents). */
export const ExportNotebookResponseSchema = z.object({
  url: z.string(),
});

export type ExportNotebookResponse = z.infer<typeof ExportNotebookResponseSchema>;
