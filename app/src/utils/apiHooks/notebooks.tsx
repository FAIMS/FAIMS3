import {
  getRecordListAudit,
  PostCreateNotebookResponse,
} from '@faims3/data-model';
import {
  QueryFunctionContext,
  useMutation,
  UseMutationOptions,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createNotebookFromTemplate,
  RecordStatus,
  validateSyncStatus,
} from '../apiOperations/notebooks';
import {checkAllRequired} from '../helpers';

export interface UseCreateNotebookFromTemplateProps {
  // Template to create notebook from
  templateId?: string;
  // Name of the project
  name?: string;
  // Listing to create in
  listingId: string;
  // Username we are working in
  username: string;
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
        username: props.username,
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

/**
 * Query hook to get the sync status of a set of records
 * from a project
 */
export const useRecordAudit = ({
  projectId,
  listingId,
  username,
}: {
  projectId: string;
  listingId: string;
  username: string;
}) => {
  const N = 2; // refetch time in minutes - maybe configure in env?
  const queryKey = ['record-audit', projectId, listingId, username];
  return useQuery({
    queryKey,
    queryFn: async (context: QueryFunctionContext) => {
      const currentStatus: RecordStatus | undefined =
        context.client.getQueryData(queryKey);
      return await validateSyncStatus({
        projectId,
        listingId,
        username,
        currentStatus,
      });
    },
    // refetch every N minutes
    refetchInterval: N * 60000,
  });
};

/**
 * Invalidate the record audit cache to force a re-fetch
 * of the record audit status
 * Needs to be called from inside a functional component
 * so not easy to use just now
 * TODO find where to call this when we save a record
 */
export const invalidateRecordAudit = ({
  projectId,
  listingId,
  username,
}: {
  projectId: string;
  listingId: string;
  username: string;
}) => {
  // Get QueryClient from the context
  const queryClient = useQueryClient();

  const queryKey = ['record-audit', projectId, listingId, username];
  return queryClient.invalidateQueries({queryKey});
};
