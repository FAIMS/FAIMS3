import Breadcrumbs from '@/components/breadcrumbs';
import {ModeToggle} from '@/components/mode-toggle';
import {AppSidebar} from '@/components/side-bar/app-sidebar';
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import {Dialog} from '@/components/ui/dialog';
import {Separator} from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {API_URL, SIGNIN_PATH} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {
  PostExchangeTokenInput,
  PostExchangeTokenResponseSchema,
} from '@faims3/data-model';
import {createFileRoute, Outlet} from '@tanstack/react-router';

interface TokenParams {
  exchangeToken?: string;
  // we ignore this - but it's still there
  serverId?: string;
}
/**
 * Exchanges the exchangeToken for an access + refresh token using the
 * /api/auth/exchange endpoint
 */
const upgradeExchangeTokenForRefresh = async ({
  exchangeToken,
  successCallback,
  errorCallback,
}: {
  exchangeToken: string;
  successCallback: (param: {access: string; refresh: string}) => Promise<void>;
  errorCallback: (msg: string) => void;
}) => {
  // We have the URL - do the exchange
  const response = await fetch(API_URL + '/api/auth/exchange', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      exchangeToken,
    } satisfies PostExchangeTokenInput),
  });

  if (!response.ok) {
    return errorCallback('Failed login exchange!');
  }

  const {accessToken, refreshToken} = PostExchangeTokenResponseSchema.parse(
    await response.json()
  );

  return await successCallback({access: accessToken, refresh: refreshToken});
};

/**
 * Route component renders the protected route with a sidebar.
 * It displays the sidebar with the user's profile and logout button.
 *
 * @returns {JSX.Element} The rendered Route component.
 */
export const Route = createFileRoute('/_protected')({
  // We may not always have these - could be stored instead
  validateSearch: (search: Record<string, string>): Partial<TokenParams> => ({
    exchangeToken: search.exchangeToken,
    serverId: search.serverId,
  }),
  beforeLoad: async ({
    context: {
      auth: {isAuthenticated, getUserDetails, user},
    },
    search: {exchangeToken},
  }) => {
    if (exchangeToken) {
      // Attempt to exchange the token and update things
      await upgradeExchangeTokenForRefresh({
        exchangeToken,
        successCallback: async ({access, refresh}) => {
          const {status, message} = await getUserDetails(access, refresh);

          if (status === 'success') {
            // After consuming the token, clean up the URL. Remove the query
            // parameters from the URL without causing a navigation
            const currentPath = window.location.pathname;
            // Just give a bit of time for changes to propagate before we strip
            // token, otherwise we immediately see state with no token + no auth and
            // get redirected!
            setTimeout(() => {
              window.history.replaceState(null, '', currentPath);
            }, 500);
            return;
          } else {
            console.error(
              "Failed to get user details on presented 'new' token: ",
              message
            );
            // redirect to login
            window.location.href = SIGNIN_PATH;
          }
        },
        errorCallback: msg => {
          console.error('Token exchange failed: msg:' + msg);
          // redirect to login
          window.location.href = SIGNIN_PATH;
        },
      });
    } else {
      if (isAuthenticated) return;

      // redirect to login
      window.location.href = SIGNIN_PATH;
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  const {user} = useAuth();

  const verification = {
    showNeedsVerification: user && !user.user.isVerified,
    email: user?.user.email,
  };

  return (
    <Dialog>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex justify-between w-full px-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <Breadcrumbs />
              </div>
              <ModeToggle />
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            {verification.showNeedsVerification && (
              <Alert>
                <AlertTitle className="text-red-700 text-lg">
                  Your email is not verified!
                </AlertTitle>
                <AlertDescription>
                  Check your emails for a verification request. Click here to
                  send another request to {verification.email}
                </AlertDescription>
              </Alert>
            )}
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </Dialog>
  );
}
