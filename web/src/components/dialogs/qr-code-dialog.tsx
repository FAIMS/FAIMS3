import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '../ui/button';
import {NOTEBOOK_NAME} from '@/constants';
import {QrCode} from 'lucide-react';

export const QRCodeDialog = ({src}: {src: string}) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <QrCode className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>QR Code</DialogTitle>
          <DialogDescription>
            Share this QR code to invite others to this {NOTEBOOK_NAME}.
          </DialogDescription>
        </DialogHeader>
        <img className="w-full" src={src} alt="QR Code" />
      </DialogContent>
    </Dialog>
  );
};
