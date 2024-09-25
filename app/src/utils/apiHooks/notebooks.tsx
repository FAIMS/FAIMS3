import {PostCreateNotebookResponse} from '@faims3/data-model';
import {useMutation, UseMutationOptions} from '@tanstack/react-query';
import {createNotebookFromTemplate} from '../apiOperations/notebooks';
import {checkAllRequired} from '../helpers';

export interface UseCreateNotebookFromTemplateProps {
  // Template to create notebook from
  templateId?: string;
  // Name of the project
  name?: string;
  // Listing to create in
  listingId: string;
  // Other options to pass through to react query mutation
  options?: UseMutationOptions<PostCreateNotebookResponse>;
}
export const useCreateNotebookFromTemplate = (
  props: UseCreateNotebookFromTemplateProps
) => {
  /**
    Hook: useCreateNotebookFromTemplate

    Mutation manager to create a new notebook from existing template.

    Only returns a mutation if values are provided
  */

  // do we have all required values?
  const requiredValues = checkAllRequired([props.templateId, props.name]);

  // Always provide the mutation even if not returned
  const mutation = useMutation<PostCreateNotebookResponse>({
    mutationFn: async () => {
      return await createNotebookFromTemplate({
        templateId: props.templateId!,
        name: props.name!,
        listingId: props.listingId,
      });
    },
    ...(props.options ?? {}),
  });

  // If not ready, do not expose the mutation operation
  if (!requiredValues) {
    return {ready: false};
  }

  return {
    ready: true,
    mutation,
  };
};
