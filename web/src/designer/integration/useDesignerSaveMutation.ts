import {useMutation, useQueryClient} from '@tanstack/react-query';

type DesignerResourceType = 'projects' | 'templates';
type DesignerApiResourceType = 'notebooks' | 'templates';

type UseDesignerSaveMutationParams = {
  resourceType: DesignerResourceType;
  apiResourceType: DesignerApiResourceType;
  resourceId: string;
  token?: string;
};

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
