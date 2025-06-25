import {DataTable} from '@/components/data-table/data-table';
import {CreateLongLivedTokenDialog} from '@/components/dialogs/long-lived-tokens/create-long-lived-token-dialog';
import {UpdateLongLivedTokenDialog} from '@/components/dialogs/long-lived-tokens/update-long-lived-token-dialog';
import {useGetLongLivedTokensColumns} from '@/components/tables/long-lived-tokens';
import {Button} from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {Label} from '@/components/ui/label';
import {Separator} from '@/components/ui/separator';
import {Switch} from '@/components/ui/switch';
import {LONG_LIVED_TOKEN_HELP_LINK} from '@/constants';
import {useAuth} from '@/context/auth-provider';
import {useIsAuthorisedTo} from '@/hooks/auth-hooks';
import {revokeLongLivedToken, useGetLongLivedTokens} from '@/hooks/queries';
import {useBreadcrumbUpdate} from '@/hooks/use-breadcrumbs';
import {Action, GetLongLivedTokensResponse} from '@faims3/data-model';
import {useQueryClient} from '@tanstack/react-query';
import {createFileRoute, ErrorComponent} from '@tanstack/react-router';
import {RefreshCw, AlertTriangle, ExternalLink} from 'lucide-react';
import {useMemo, useState} from 'react';

export const Route = createFileRoute('/_protected/profile/long-lived-tokens')({
  component: RouteComponent,
});

/**
 * RouteComponent component renders the users page.
 * It displays a table with the user's information.
 *
 * @returns {JSX.Element} The rendered RouteComponent component.
 */
function RouteComponent() {
  const {user: authUser} = useAuth();
  const queryClient = useQueryClient();

  if (!authUser) {
    return <ErrorComponent error={'Not authorised'} />;
  }

  // breadcrumbs addition
  const paths = useMemo(
    () => [
      {
        path: '/profile',
        label: 'User Profile',
      },
      {
        path: '/profile/long-lived-tokens',
        label: 'Manage API Tokens',
      },
    ],
    []
  );

  useBreadcrumbUpdate({
    isLoading: false,
    paths,
  });

  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<
    GetLongLivedTokensResponse['tokens'][number] | undefined
  >(undefined);

  // Control panel state
  const [adminMode, setAdminMode] = useState<boolean>(false);
  const [showRevoked, setShowRevoked] = useState<boolean>(false);
  const [showExpired, setShowExpired] = useState<boolean>(false);

  const {data, isPending} = useGetLongLivedTokens({
    user: authUser,
    fetchAll: adminMode,
  });

  // Can the user create a long lived token?
  const canCreateToken = useIsAuthorisedTo({
    action: Action.CREATE_LONG_LIVED_TOKEN,
  });

  // Can the user view all tokens (admin mode)?
  const canViewAllTokens = useIsAuthorisedTo({
    action: Action.READ_ANY_LONG_LIVED_TOKENS,
  });

  // Filter tokens based on control panel settings
  const filteredTokens = useMemo(() => {
    if (!data?.tokens) return [];

    return data.tokens.filter(token => {
      // Filter out revoked tokens if not showing them
      if (!showRevoked && !token.enabled) {
        return false;
      }

      // Filter out expired tokens if not showing them
      if (!showExpired && token.expiresAt && token.expiresAt < Date.now()) {
        return false;
      }

      return true;
    });
  }, [data?.tokens, showRevoked, showExpired]);

  return (
    <div className="space-y-4">
      {/* Information Card */}
      <Card className="border-slate-200 bg-slate-50/30 p-1">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-slate-800 text-lg">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Long-Lived API Tokens
          </CardTitle>
          <CardDescription className="text-slate-600 text-sm">
            Secure authentication for automated system access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-slate-700 space-y-3">
            <p>
              <span className="font-medium text-slate-800">Purpose:</span> These
              tokens enable programmatic access to system APIs. They must be
              exchanged for short-lived access tokens before use.
            </p>
            <p>
              <span className="font-medium text-slate-800">Security:</span>{' '}
              Long-lived tokens grant full account access. Store securely, never
              share, and revoke immediately if compromised.
            </p>
          </div>
          <div className="pt-3 border-t border-slate-200">
            <a
              href={LONG_LIVED_TOKEN_HELP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800 hover:underline"
            >
              Learn more about implementation and security
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Control Panel */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-6">
            {/* Admin Mode Toggle switches */}
            {canViewAllTokens && (
              <>
                <div className="flex items-center gap-3">
                  <Switch
                    id="admin-mode"
                    checked={adminMode}
                    onCheckedChange={setAdminMode}
                    className="data-[state=checked]:bg-green-300"
                  />
                  <div>
                    <Label
                      htmlFor="admin-mode"
                      className="text-sm font-medium cursor-pointer"
                    >
                      Admin Mode
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      View all users' tokens
                    </p>
                  </div>
                </div>
                <Separator orientation="vertical" className="h-8" />
              </>
            )}

            {/* Token Status Filters */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <Switch
                  id="show-revoked"
                  checked={showRevoked}
                  onCheckedChange={setShowRevoked}
                  className="data-[state=checked]:bg-green-300"
                />
                <div>
                  <Label
                    htmlFor="show-revoked"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Show Revoked
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Include disabled tokens
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="show-expired"
                  checked={showExpired}
                  onCheckedChange={setShowExpired}
                  className="data-[state=checked]:bg-green-300"
                />
                <div>
                  <Label
                    htmlFor="show-expired"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Show Expired
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Include expired tokens
                  </p>
                </div>
              </div>
            </div>
            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({
                  queryKey: ['long-lived-tokens'],
                });
              }}
              disabled={isPending}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Update Dialog */}
      {selectedToken && (
        <UpdateLongLivedTokenDialog
          open={updateDialogOpen}
          setOpen={setUpdateDialogOpen}
          token={selectedToken}
        />
      )}

      {/* Data Table */}
      <DataTable
        columns={useGetLongLivedTokensColumns({
          editTokenHandler: async tokenId => {
            const token = (data?.tokens ?? []).find(t => t.id === tokenId);
            if (token) {
              setSelectedToken(token);
              setUpdateDialogOpen(true);
            }
          },
          revokeTokenHandler: async tokenId => {
            await revokeLongLivedToken({user: authUser, tokenId});
            queryClient.invalidateQueries({queryKey: ['long-lived-tokens']});
          },
        })}
        data={filteredTokens}
        loading={isPending}
        defaultRowsPerPage={15}
        button={canCreateToken && <CreateLongLivedTokenDialog />}
      />
    </div>
  );
}
