import {Form} from '@/components/form';
import {useAuth} from '@/context/auth-provider';
import {createLongLivedToken} from '@/hooks/queries';
import {useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';
import {useState, useEffect} from 'react';
import {Button} from '@/components/ui/button';
import {Alert, AlertTitle, AlertDescription} from '@/components/ui/alert';
import {Copy, CheckCircle, AlertTriangle} from 'lucide-react';
import {
  LONG_LIVED_TOKEN_HELP_LINK,
  MAXIMUM_LONG_LIVED_DURATION_DAYS,
  LONG_LIVED_TOKEN_DURATION_HINTS,
} from '@/constants';
import {ExpirySelector} from '@/components/expiry-selector';

interface CreateLongLivedTokenFormProps {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onInterceptClose?: () => void; // Callback to handle close interception
}

/**
 * Renders a form for creating a long-lived token.
 */
export function CreateLongLivedTokenForm({
  setDialogOpen,
  onInterceptClose,
}: CreateLongLivedTokenFormProps) {
  const {user} = useAuth();
  const QueryClient = useQueryClient();
  const [createdToken, setCreatedToken] = useState<string | undefined>(
    undefined
  );
  const [copied, setCopied] = useState(false);
  const [selectedDateTime, setSelectedDateTime] = useState<string | undefined>(
    undefined
  );

  // Set up close interception when token is displayed
  useEffect(() => {
    if (createdToken && onInterceptClose) {
      onInterceptClose();
    }
  }, [createdToken, onInterceptClose]);

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
   * Handles copying the token to clipboard
   */
  const handleCopy = async () => {
    if (!createdToken) return;

    try {
      await navigator.clipboard.writeText(createdToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy token:', err);
    }
  };

  /**
   * Handles closing the dialog
   */
  const handleConfirmedClose = () => {
    setCreatedToken(undefined);
    setCopied(false);
    setDialogOpen(false);
  };

  /**
   * Handles the form submission
   */
  const onSubmit = async ({title, description}: onSubmitProps) => {
    if (!user) return {type: 'submit', message: 'User not authenticated'};

    // Validate expiry selection
    if (!selectedDateTime) {
      return {type: 'submit', message: 'Please select an expiry date'};
    }

    // Get expiry timestamp
    let expiryTimestampMs: number | undefined = undefined;

    if (selectedDateTime === 'never') {
      // Never expires - we'll pass undefined
      expiryTimestampMs = undefined;
    } else {
      const expiryDate = new Date(selectedDateTime);
      expiryTimestampMs = expiryDate.getTime();

      if (isNaN(expiryTimestampMs)) {
        return {type: 'submit', message: 'Invalid expiry date'};
      }

      // Additional validation for maximum duration
      if (MAXIMUM_LONG_LIVED_DURATION_DAYS) {
        const now = new Date();
        const daysDiff =
          (expiryTimestampMs - now.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff > MAXIMUM_LONG_LIVED_DURATION_DAYS) {
          return {
            type: 'submit',
            message: `Token expiry cannot be more than ${MAXIMUM_LONG_LIVED_DURATION_DAYS} days from now`,
          };
        }
      }
    }

    try {
      const response = await createLongLivedToken({
        description,
        title,
        user,
        expiryTimestampMs,
      });

      setCreatedToken(response.token);

      QueryClient.invalidateQueries({
        queryKey: ['long-lived-tokens'],
      });
    } catch (error) {
      return {
        type: 'submit',
        message: `Error creating token. Error: ${error}.`,
      };
    }
  };

  // If token was successfully created, show the token display
  if (createdToken) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Important - Save Your Token</AlertTitle>
          <AlertDescription>
            This token will only be shown once. Make sure to copy and store it
            securely. You will not be able to see it again after closing this
            dialog.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <label className="text-sm font-medium">Your API Token:</label>
          <div className="flex gap-2">
            <div className="flex-1 p-3 bg-muted rounded-md font-mono text-sm break-all border overflow-hidden">
              <div className="whitespace-pre-wrap break-all">
                {createdToken}
              </div>
            </div>
            <Button
              onClick={handleCopy}
              variant="outline"
              size="sm"
              className="shrink-0"
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>

        <Alert>
          <AlertTitle>How to use this token</AlertTitle>
          <AlertDescription>
            This long-lived token cannot be used directly for API requests. You
            must first exchange it for a short-lived access token using your
            system's API:
            <code className="block mt-2 p-2 bg-muted rounded text-sm break-all">
              POST /api/auth/exchange-long-lived-token
              <br />
              Content-Type: application/json
              <br />
              <br />
              {`{"token": "${createdToken}"}`}
            </code>
            The response will contain an access token that you can use with the
            Authorization header:
            <code className="block mt-2 p-2 bg-muted rounded text-sm break-all">
              Authorization: Bearer &lt;access_token&gt;
            </code>
            <a
              href={LONG_LIVED_TOKEN_HELP_LINK}
              className="inline-flex items-center mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn more about API token usage →
            </a>
          </AlertDescription>
        </Alert>
        <Button
          onClick={handleConfirmedClose}
          variant="destructive"
          className="w-full"
        >
          I've Saved My Token - Close
        </Button>
      </div>
    );
  }

  // Show the creation form
  return (
    <div className="space-y-6">
      {/* Form Fields */}
      <Form
        fields={fields}
        onSubmit={onSubmit}
        submitButtonText="Create Long-Lived Token"
        submitButtonVariant="outline"
        footer={
          <ExpirySelector
            hints={LONG_LIVED_TOKEN_DURATION_HINTS}
            maxDurationDays={MAXIMUM_LONG_LIVED_DURATION_DAYS}
            selectedDateTime={selectedDateTime}
            setSelectedDateTime={setSelectedDateTime}
            title="Token Duration"
            subtitle="Choose how long this token should remain valid"
            showMaxDurationInfo={true}
          />
        }
      />
    </div>
  );
}
