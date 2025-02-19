import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {useAuth} from '@/context/auth-provider';
import {useMutation} from '@tanstack/react-query';
import React from 'react';
import {Button} from '../ui/button';
import {Spinner} from '../ui/spinner';

/**
 */
export const GeneratePasswordReset = ({
  userId,
  open,
  setOpen,
}: {
  userId?: string;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  // User auth
  const {user} = useAuth();
  if (!user) return null;

  // Expect user ID
  if (!userId) return null;

  /**
   * Handles submission of request for reset code
   */
  const resetCode = useMutation({
    mutationKey: ['resetpassword', userId],
    mutationFn: async ({id}: {id: string}) => {
      return await fetch(`${import.meta.env.VITE_API_URL}/api/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          email: id,
        }),
      }).then(async res => {
        return (await res.json()) as {code: string; url: string};
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset User Password</DialogTitle>
          <DialogDescription>
            Generate a password reset link for user: <b>{userId}</b>.
          </DialogDescription>
        </DialogHeader>
        {resetCode.isPending ? (
          <Spinner />
        ) : resetCode.data ? (
          <>
            <p> RESULT : {resetCode.data.url}</p>
            <Button
              onClick={() => {
                resetCode.reset();
              }}
            >
              Clear
            </Button>
          </>
        ) : (
          <Button
            onClick={() => {
              resetCode.mutate({id: userId});
            }}
          >
            Submit
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};
