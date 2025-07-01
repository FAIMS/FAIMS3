import {Form} from '@/components/form';
import {useAuth} from '@/context/auth-provider';
import {updateLongLivedToken} from '@/hooks/queries';
import {useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';
import {GetLongLivedTokensResponse} from '@faims3/data-model';

interface UpdateLongLivedTokenFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  token: GetLongLivedTokensResponse['tokens'][number];
}

/**
 * Renders a form for updating a long-lived token.
 */
export function UpdateLongLivedTokenForm({
  setDialogOpen,
  token,
}: UpdateLongLivedTokenFormProps) {
  const {user} = useAuth();
  const queryClient = useQueryClient();

  const fields = [
    {
      name: 'title',
      label: 'Title',
      schema: z.string().min(5, {
        message: 'Title must be at least 5 characters',
      }),
    },
    {
      name: 'description',
      label: 'Description',
      schema: z.string().min(10, {
        message: 'Description must be at least 10 characters',
      }),
    },
  ];

  interface onSubmitProps {
    title: string;
    description: string;
  }

  /**
   * Handles the form submission
   */
  const onSubmit = async ({title, description}: onSubmitProps) => {
    if (!user) return {type: 'submit', message: 'User not authenticated'};

    try {
      await updateLongLivedToken({
        tokenId: token.id,
        title,
        description,
        user,
      });

      // Invalidate the long-lived tokens query to refresh the list
      queryClient.invalidateQueries({
        queryKey: ['long-lived-tokens'],
      });

      setDialogOpen(false);
    } catch (error) {
      return {
        type: 'submit',
        message: `Error updating token. Error: ${error}.`,
      };
    }
  };

  return (
    <Form
      fields={fields}
      onSubmit={onSubmit}
      submitButtonText={'Update Token'}
      submitButtonVariant={'outline'}
      defaultValues={{
        title: token.title,
        description: token.description,
      }}
    />
  );
}
