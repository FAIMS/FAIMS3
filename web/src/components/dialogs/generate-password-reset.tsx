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
import {AlertCircle, LinkIcon, QrCode, RefreshCw} from 'lucide-react';
import QRCode from 'qrcode';
import React, {useEffect, useState} from 'react';
import {Alert, AlertDescription, AlertTitle} from '../ui/alert';
import {Button} from '../ui/button';
import {CopyButton} from '../ui/copy-button';
import {Spinner} from '../ui/spinner';
import {Card, CardContent} from '../ui/card';

/**
 * Displays a QR code in a clickable format that opens a larger view in a dialog.
 * @param props.qrData - Base64 encoded QR code image data
 */
const QRCodeViewDialog = ({qrData}: {qrData: string}) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="p-0 h-auto w-auto hover:bg-transparent"
        >
          <img
            src={qrData}
            alt="Reset link QR code"
            className="h-32 w-32 cursor-pointer hover:opacity-80 transition-opacity"
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
  const {data, isPending, mutate, error, isError, reset} = useMutation({
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
        if (res.ok) {
          return (await res.json()) as {code: string; url: string};
        } else {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.message ||
              `Failed to generate reset link (${res.status}: ${res.statusText})`
          );
        }
      });
    },
  });

  useEffect(() => {
    if (data?.code) {
      QRCode.toDataURL(data.url)
        .then(url => setQrCodeData(url))
        .catch(err => console.error('Error generating QR code:', err));
    }
  }, [data?.code]);

  const handleRetry = () => {
    reset();
    mutate({id: userId});
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reset User Password</DialogTitle>
          <DialogDescription>
            Generate a password reset link for user:{' '}
            <span className="font-semibold">{userId}</span>
          </DialogDescription>
        </DialogHeader>

        {isError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>{error?.message || 'Failed to generate reset link'}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetry}
                className="self-start mt-2 flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" /> Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isPending ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Spinner className="mb-2 h-8 w-8" />
            <span className="text-sm text-muted-foreground">
              Generating reset link...
            </span>
          </div>
        ) : data ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-2">
                <div className="flex flex-row justify-between">
                  <div className="flex items-center gap-2 mb-1 text-sm font-medium text-muted-foreground">
                    <LinkIcon className="h-4 w-4" />
                    <span>Reset Link</span>
                  </div>
                  <div className="flex flex-row items-center gap-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      Copy
                    </p>
                    <CopyButton value={data.url} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {qrCodeData && (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <QrCode className="h-4 w-4" />
                  <span>Click QR code to enlarge</span>
                </div>
                <div className="border rounded-lg p-2 bg-white">
                  <QRCodeViewDialog qrData={qrCodeData} />
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={() => mutate({id: userId})} variant="outline">
                Generate New Link
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="text-center text-muted-foreground">
              <QrCode className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>Generate a secure password reset link with QR code</p>
            </div>
            <Button onClick={() => mutate({id: userId})}>
              Generate Reset Link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
