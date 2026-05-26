import {AuthContext} from '@/context/auth-provider';
import {Outlet, createRootRouteWithContext} from '@tanstack/react-router';
import {Button} from '@/components/ui/button';
import Bugsnag from '@bugsnag/js';
import {AlertCircle} from 'lucide-react';
import {useEffect, useRef} from 'react';
import {BUGSNAG_API_KEY} from '@/constants';

const bugsnagEnabled = BUGSNAG_API_KEY !== undefined;

// Create a custom error component
function CustomErrorComponent({error}: {error: Error}) {
  const reportedErrorRef = useRef<Error | null>(null);

  // Report error to Bugsnag (once per unique error)
  useEffect(() => {
    if (bugsnagEnabled && reportedErrorRef.current !== error) {
      reportedErrorRef.current = error;
      Bugsnag.notify(error, event => {
        event.context = 'TanStack Router errorComponent';
      });
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <AlertCircle className="h-12 w-12 text-red-500" />
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-gray-900">
              Sorry, something went wrong
            </h3>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          An unexpected error occurred.
          {bugsnagEnabled &&
            ' This error has been automatically reported to our team.'}
        </p>
        {import.meta.env.DEV && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded mb-4 font-mono">
            {error.message || 'Unknown error'}
          </div>
        )}
        <Button variant="outline" onClick={() => (window.location.href = '/')}>
          Return to Home Page
        </Button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{auth: AuthContext}>()({
  component: () => <Outlet />,
  errorComponent: CustomErrorComponent,
});
