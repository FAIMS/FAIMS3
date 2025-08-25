import {User} from '@/context/auth-provider';

export const createTemplateRequest = async ({
  user,
  name,
  teamId,
  templateData,
}: {
  user: User;
  name: string;
  teamId: string;
  templateData: any;
}) => {
  return await fetch(`${import.meta.env.VITE_API_URL}/api/templates/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
    body: JSON.stringify({
      ...templateData,
      teamId,
      name,
    }),
  });
};

export const updateTemplateRequest = async ({
  user,
  templateId,
  name,
  teamId,
  templateData,
}: {
  user: User;
  templateId: string;
  name?: string;
  teamId?: string;
  templateData?: {metadata: any; 'ui-specification': any};
}) => {
  return await fetch(
    `${import.meta.env.VITE_API_URL}/api/templates/${templateId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({
        ...templateData,
        teamId,
        name,
      }),
    }
  );
};
