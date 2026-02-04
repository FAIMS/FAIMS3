import {VerificationAlertComponent} from '@/components/alerts/verification-alert';
import Breadcrumbs from '@/components/breadcrumbs';
import {LogoIcon} from '@/components/logo';
import {ModeToggle} from '@/components/mode-toggle';
import {SessionExpiredOverlay} from '@/components/session-expired-overlay';
import {AppSidebar} from '@/components/side-bar/app-sidebar';
import {Button} from '@/components/ui/button';
import {Dialog} from '@/components/ui/dialog';
import {SidebarInset, SidebarProvider} from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  API_URL,
  APP_NAME,
  APP_SHORT_NAME,
  APP_URL,
  SIGNIN_PATH,
} from '@/constants';
import {getStoredUser, isUserExpired, useAuth} from '@/context/auth-provider';
import {useRequestVerify} from '@/hooks/queries';
import {
  PostExchangeTokenInput,
  PostExchangeTokenResponseSchema,
} from '@faims3/data-model';
import {createFileRoute, Outlet} from '@tanstack/react-router';
import {ExternalLinkIcon} from 'lucide-react';
import {toast} from 'sonner';

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
  successCallback: (param: {
    access: string;
    refresh: string;
  }) => Promise<boolean>;
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
      auth: {isAuthenticated, getUserDetails},
    },
    search: {exchangeToken},
  }) => {
    if (exchangeToken) {
      // Attempt to exchange the token and update the stored user
      const success = await upgradeExchangeTokenForRefresh({
        exchangeToken,
        successCallback: async ({access, refresh}) => {
          const {status, message} = await getUserDetails(access, refresh);

          if (status === 'success') {
            // After consuming the token, clean up the URL. Remove the query
            // parameters from the URL without causing a navigation
            const currentPath = window.location.pathname;
            // strip the token from the url
            window.history.replaceState(null, '', currentPath);
            // and return success
            return true;
          } else {
            console.error(
              "Failed to get user details on presented 'new' token: ",
              message
            );
            // all is not good - we will redirect to login
            return false;
          }
        },
        errorCallback: msg => {
          console.error('Token exchange failed: msg:' + msg);
          // all is not good - we will redirect to login
          return false;
        },
      });
      // and if that worked, we're good to render this page
      if (success) return;

      // otherwise we need to redirect to login
      window.location.href = SIGNIN_PATH;
      return;
    }

    // No exchange token so re-check authentication after potential token exchange
    // This handles the case where we just set the user but haven't re-rendered yet
    const parsedUser = getStoredUser();
    if (!isUserExpired(parsedUser)) {
      // Token is good we can render
      return;
    }

    // No valid authentication found - redirect to login
    if (!isAuthenticated) {
      window.location.href = SIGNIN_PATH;
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  const {user, isAuthenticated, isExpired} = useAuth();
  const {mutate: verify, isPending: verifyLoading} = useRequestVerify();

  const verification = {
    showNeedsVerification: user && !user.user.isVerified,
    email: user?.user.email,
  };

  // Show the SessionExpiredOverlay instead of redirecting immediately
  if (!isAuthenticated || isExpired()) {
    return <SessionExpiredOverlay />;
  }

  return (
    <Dialog>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex justify-between w-full px-4">
              <div className="flex items-center gap-2">
                <Breadcrumbs />
              </div>
              <div className="flex">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Button variant="outline" className="mr-2 p-2">
                        <a href={APP_URL} target="_blank">
                          <span className="mr-2">
                            <LogoIcon size={24} />
                          </span>
                          <span className="align-middle font-semibold">
                            {APP_SHORT_NAME} App{' '}
                          </span>
                          <ExternalLinkIcon className="inline-block" />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="w-32 text-balance">
                      Open the {APP_NAME} data collection app in a new window
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <ModeToggle />
              </div>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            {verification.showNeedsVerification && (
              <VerificationAlertComponent
                email={verification.email ?? 'Unknown'}
                isLoading={verifyLoading}
                onRequestVerification={() => {
                  user &&
                    verify(
                      {user},
                      {
                        onSuccess: () => {
                          toast.success(
                            'Successfully sent verification email.'
                          );
                        },
                        onError: error => {
                          toast.error(
                            'Failed to send verification email. Error: ' +
                              error.message
                          );
                        },
                      }
                    );
                }}
              />
            )}
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </Dialog>
  );
}
