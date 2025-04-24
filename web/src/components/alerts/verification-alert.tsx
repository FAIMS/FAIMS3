import {Alert, AlertDescription, AlertTitle} from '../ui/alert';
import {Button} from '../ui/button';

interface VerificationAlertComponentProps {
  email: string;
  onRequestVerification: () => void;
  isLoading: boolean;
}
export const VerificationAlertComponent = ({
  email,
  isLoading,
  onRequestVerification,
}: VerificationAlertComponentProps) => {
  return (
    <Alert>
      <AlertTitle className="text-red-700 text-lg">
        Your email is not verified!
      </AlertTitle>
      {isLoading ? (
        <AlertDescription>
          Sending verification email...please wait.
        </AlertDescription>
      ) : (
        <AlertDescription>
          Check your emails for a verification request.{' '}
          <Button
            variant="link"
            onClick={onRequestVerification}
            className="p-0 h-auto"
          >
            Click here
          </Button>{' '}
          to send another request to <b>{email}</b>.
        </AlertDescription>
      )}
    </Alert>
  );
};
