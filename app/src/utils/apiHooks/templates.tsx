import {useQuery} from 'react-query';
import {buildQueryKey} from '../helpers';
import {fetchTemplates} from '../apiOperations/templates';
import {GetListTemplatesResponse} from '@faims3/data-model';

export interface UseGetTemplatesProps {
  // Which listing to get templates for
  listingId: string;
}

/**
  Hook: useGetTemplates
  React query wrapper to fetch templates from the API.
*/
export const useGetTemplates = (props: UseGetTemplatesProps) => {
  // Index off the listing id and operation
  return useQuery<GetListTemplatesResponse>(
    buildQueryKey(['get template list', props.listingId]),
    {
      queryFn: async () => {
        return await fetchTemplates(props.listingId);
      },
    }
  );
};
