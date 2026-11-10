// SPDX-License-Identifier: Apache-2.0

/**
 * @file TanStack Query mutation to PUT designer-exported JSON and refresh cached notebook data.
 */

import {useMutation, useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {config} from '@/constants';

/** React-query cache key prefix for the parent resource (e.g. `projects`). */
type DesignerResourceType = 'projects' | 'templates';

/** REST path segment under `/api/:type/:id` (projects use `notebooks`). */
type DesignerApiResourceType = 'notebooks' | 'templates';

type UseDesignerSaveMutationParams = {
  /** Key used with `useQueryClient` (`['projects', id]` or `['templates', id]`). */
  resourceType: DesignerResourceType;
  /** API collection name for the PUT URL. */
  apiResourceType: DesignerApiResourceType;
  resourceId: string;
  token?: string;
};

/** Optional If-Match (`uiSpecProperties.hash`) for a conditional publish. */
export type DesignerPublishOptions = {
  ifMatch?: string;
};

/**
 * PUT /uiSpecification returned 409: the live hash no longer matches If-Match.
 * The host overlay should confirm overwrite (omit If-Match) rather than retry.
 */
export class DesignerUiSpecConflictError extends Error {
  readonly status = 409;
  constructor(
    message = 'The live design has changed since this draft was opened. Reload the live design or confirm overwrite.'
  ) {
    super(message);
    this.name = 'DesignerUiSpecConflictError';
  }
}

export function quoteUiSpecIfMatch(hash?: string): string | undefined {
  if (!hash) {
    return undefined;
  }
  return `"${hash}"`;
}

const downloadJsonFile = (jsonText: string, filename: string) => {
  const blob = new Blob([jsonText], {type: 'application/json'});

  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
};

function conflictMessageFromBody(errorText: string): string {
  try {
    const body = JSON.parse(errorText) as {error?: {message?: string}};
    if (body.error?.message) {
      return body.error.message;
    }
  } catch {
    // Body is not JSON; keep the default conflict copy.
  }
  return new DesignerUiSpecConflictError().message;
}

/**
 * Mutation that uploads designer-exported JSON (File) via PUT and refreshes
 * the matching react-query entry.
 *
 * @param params - Cache key vs API path (projects save to `/api/notebooks/...`).
 * @returns TanStack `useMutation` result (`mutate`, `isPending`, etc.).
 */
export const useDesignerSaveMutation = ({
  resourceType,
  apiResourceType,
  resourceId,
  token,
}: UseDesignerSaveMutationParams) => {
  const queryClient = useQueryClient();
  const queryKey = [resourceType, resourceId] as const;

  const mutation = useMutation({
    mutationFn: async ({file, ifMatch}: {file: File; ifMatch?: string}) => {
      const jsonText = await file.text();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      const quoted = quoteUiSpecIfMatch(ifMatch);
      if (quoted) {
        headers['If-Match'] = quoted;
      }
      const response = await fetch(
        `${config.apiUrl}/api/${apiResourceType}/${resourceId}/uiSpecification`,
        {
          method: 'PUT',
          headers,
          body: jsonText,
        }
      );

      if (response.status === 409) {
        const errorText = await response.text();
        throw new DesignerUiSpecConflictError(
          conflictMessageFromBody(errorText)
        );
      }

      if (!response.ok) {
        const errorText = await response.text();

        console.error(`Designer save failed: ${response.status} ${errorText}`);

        throw new Error(
          `Status code: ${response.status} (${response.statusText})`
        );
      }

      return response.json();
    },

    retry: (failureCount, error) => {
      if (error instanceof DesignerUiSpecConflictError) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: 1000 * 2,

    onSuccess: updatedNotebook => {
      queryClient.setQueryData(queryKey, () => updatedNotebook);
      queryClient.invalidateQueries({queryKey});
    },
  });

  // Wraps the designer save mutation with toast feedback
  // and a JSON download fallback link if the save fails.
  const mutateAsyncWithToast = async (
    file: File,
    options?: DesignerPublishOptions
  ) => {
    const jsonText = await file.text();
    const toastId = toast.loading('Designer saving...');

    try {
      const result = await mutation.mutateAsync({
        file,
        ifMatch: options?.ifMatch,
      });
      toast.success('Designer saved successfully.', {id: toastId});
      return result;
    } catch (error) {
      if (error instanceof DesignerUiSpecConflictError) {
        toast.dismiss(toastId);
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'No error message provided';

      toast.error('Designer save failed', {
        id: toastId,
        description: `${errorMessage}. Your changes were not saved. Download the updated JSON and upload it again later.`,
        action: {
          label: 'Download JSON',
          onClick: () => {
            downloadJsonFile(
              jsonText,
              `${resourceType}-${resourceId}-unsaved-designer.json`
            );
          },
        },
      });
      throw error;
    }
  };

  return {
    ...mutation,
    mutateAsyncWithToast,
  };
};
