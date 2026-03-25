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

  return useMutation<unknown, Error, File>({
    mutationFn: async file => {
      const jsonText = await file.text();
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/${apiResourceType}/${resourceId}`,
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
        throw new Error(`Save failed: ${response.status} ${errorText}`);
      }

      return response.json();
    },
    onSuccess: updatedNotebook => {
      queryClient.setQueryData(queryKey, () => updatedNotebook);
      queryClient.invalidateQueries({queryKey});
    },
  });
};
