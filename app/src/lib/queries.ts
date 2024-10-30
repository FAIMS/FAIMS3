import {useQuery} from '@tanstack/react-query';
import {getUiSpecForProject} from '../uiSpecification';

export const useGetUISpec = (project_id: string) => {
  return useQuery({
    queryKey: ['uiSpec', project_id],
    queryFn: () => getUiSpecForProject(project_id),
  });
};
