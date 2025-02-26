import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {useAuth} from '@/context/auth-provider';
import {useMutation} from '@tanstack/react-query';
import React, {useEffect, useState} from 'react';
import {Button} from '../ui/button';
import {Spinner} from '../ui/spinner';
import {CopyButton} from '../ui/copy-button';
import QRCode from 'qrcode';

/**
 * Displays a QR code in a clickable format that opens a larger view in a dialog.
 * @param props.qrData - Base64 encoded QR code image data
 */
const QRCodeViewDialog = ({qrData}: {qrData: string}) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="p-0 h-48 w-48 hover:bg-transparent">
          <img
            src={qrData}
            alt="Reset link QR code"
            className="h-full w-full cursor-pointer hover:opacity-80 transition-opacity"
          />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Password Reset QR Code</DialogTitle>
          <DialogDescription>
            Scan this QR code to access the password reset link
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center p-4">
          <img src={qrData} alt="Reset link QR code" className="h-96 w-96" />
        </div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * A dialog component that generates and displays password reset links with QR codes.
 * Features:
 * - Generates a secure reset link for a specified user
 * - Displays the link with a copy button
 * - Creates a scannable QR code that can be enlarged
 * - Handles loading states and error cases
 *
 * @param userId - The ID of the user requesting password reset
 * @param open - Controls the visibility of the dialog
 * @param setOpen - Function to update dialog visibility
 * @returns Returns null if user is not authenticated or userId is missing
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
  const {user} = useAuth();
  if (!user) return null;
  if (!userId) return null;

  const [qrCodeData, setQrCodeData] = useState<string>('');
  const {data, isPending, mutate} = useMutation({
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

  useEffect(() => {
    if (data?.code) {
      QRCode.toDataURL(
        `${import.meta.env.VITE_WEB_URL}/reset-password?code=${data.code}`
      )
        .then(url => setQrCodeData(url))
        .catch(err => console.error('Error generating QR code:', err));
    }
  }, [data?.code]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset User Password</DialogTitle>
          <DialogDescription>
            Generate a password reset link for user: <b>{userId}</b>
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <div className="flex justify-center p-4">
            <Spinner />
          </div>
        ) : data ? (
          <div className="space-y-6">
            <div className="flex items-center space-x-2">
              <div className="flex-1 rounded-md border p-2">
                <code className="text-sm">{`${import.meta.env.VITE_WEB_URL}/reset-password?code=${data.code}`}</code>
              </div>
              <CopyButton
                value={`${import.meta.env.VITE_WEB_URL}/reset-password?code=${data.code}`}
              />
            </div>

            {qrCodeData && (
              <div className="flex flex-col items-center space-y-2">
                <div className="text-sm text-muted-foreground">
                  Click QR code to enlarge
                </div>
                <QRCodeViewDialog qrData={qrCodeData} />
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => mutate({id: userId})} variant="outline">
                Generate New Link
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end py-4">
            <Button onClick={() => mutate({id: userId})}>
              Generate Reset Link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
