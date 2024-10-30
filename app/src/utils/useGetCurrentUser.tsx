import {useQuery} from '@tanstack/react-query';
import {ProjectID} from '@faims3/data-model';
import {getCurrentUserId} from '../users';

export const useGetCurrentUser = (project_id: ProjectID) => {
  return useQuery<string, Error>({
    queryKey: ['currentUser', project_id],
    queryFn: async () => {
      try {
        return await getCurrentUserId(project_id);
      } catch (error) {
        console.error('Error fetching user ID:', error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};
