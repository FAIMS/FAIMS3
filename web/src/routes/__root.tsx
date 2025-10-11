import {AuthContext} from '@/context/auth-provider';
import {Outlet, createRootRouteWithContext} from '@tanstack/react-router';
import {Button} from '@/components/ui/button';

// Create a custom error component
function CustomErrorComponent({error}: {error: Error}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <img src="/assets/icons/icon-48.webp" />
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-gray-900">
              Sorry, something went wrong
            </h3>
          </div>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <div className="text-sm text-gray-500 mb-4">
            {error.message || 'An unexpected error occurred'}
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
