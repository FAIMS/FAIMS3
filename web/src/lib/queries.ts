import {useQuery} from '@tanstack/react-query';
import {get} from './utils';
import {User} from '@/auth';

export const getSurveys = (user: User) =>
  useQuery({
    queryKey: ['surveys'],
    queryFn: () => get('/api/notebooks', user),
  });

export const getTemplates = (user: User) =>
  useQuery({
    queryKey: ['templates'],
    queryFn: async () => (await get('/api/templates', user)).templates,
  });
