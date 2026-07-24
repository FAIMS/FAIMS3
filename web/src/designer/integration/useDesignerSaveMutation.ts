// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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

const downloadJsonFile = (jsonText: string, filename: string) => {
  const blob = new Blob([jsonText], {type: 'application/json'});

  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
};

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
    mutationFn: async (file: File) => {
      const jsonText = await file.text();
      const response = await fetch(
        `${config.apiUrl}/api/${apiResourceType}/${resourceId}/uiSpecification`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: jsonText,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();

        console.error(`Designer save failed: ${response.status} ${errorText}`);

        throw new Error(
          `Status code: ${response.status} (${response.statusText})`
        );
      }

      return response.json();
    },

    // Retry failed saves.
    retry: 3,
    retryDelay: 1000 * 2,

    onSuccess: updatedNotebook => {
      queryClient.setQueryData(queryKey, () => updatedNotebook);
      queryClient.invalidateQueries({queryKey});
    },
  });

  // Wraps the designer save mutation with toast feedback
  // and a JSON download fallback link if the save fails.
  const mutateAsyncWithToast = async (file: File) => {
    const jsonText = await file.text();

    return toast.promise(mutation.mutateAsync(file), {
      loading: 'Designer saving...',
      success: 'Designer saved successfully.',
      error: error => {
        const errorMessage = error?.message || 'No error message provided';

        return {
          message: 'Designer save failed',
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
        };
      },
    });
  };

  return {
    ...mutation,
    mutateAsyncWithToast,
  };
};
