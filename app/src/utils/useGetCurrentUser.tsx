import {ProjectID} from '@faims3/data-model';
import {useQuery} from '@tanstack/react-query';
import {getAllUserInfo, getCurrentUserId} from '../users';

/**
 * For a given project ID, refers to the local auth db to get the user ID activated
 * @param project_id The project ID to get user for
 * @returns The user ID for the current user
 */
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

/**
 * Fetches all user info from the local auth DB
 * @returns All user info from the auth DB
 */
export const useGetAllUserInfo = () => {
  return useQuery({
    queryKey: ['alluserinfo'],
    queryFn: async () => {
      try {
        return await getAllUserInfo();
      } catch (error) {
        console.error('Error fetching user info:', error);
        throw error;
      }
    },
    // I don't think we want to cache this?
    // TODO consider caching implications for user info
    staleTime: Infinity,
    retry: 1,
  });
};
