// SPDX-License-Identifier: Apache-2.0
/**
 * Quick Share: one temporary QR code for an activated survey.
 *
 * The notebook header uses the labelled Share button on wide screens and a
 * compact share icon on narrow ones. Settings uses the same dialog from a
 * card laid out like deactivation: heading, description, then an action
 * button. Generate
 * stores the code on the project with the username of the person who created
 * it. The dialog then only shows that code to them — its role, when it
 * expires, and a tap-to-enlarge QR — until they generate a new one. That
 * deletes the invite, then the generate form comes back. Every code lasts one
 * hour. An expired code is dropped, and the dialog shows the generate form
 * again. Someone else's code stays stored for its creator and is not shown.
 * The person who created a code can always revoke it, including after their
 * access is lowered.
 */

import CloseIcon from '@mui/icons-material/Close';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import ShareIcon from '@mui/icons-material/Share';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {useTheme, type SxProps, type Theme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {Role, projectRolesUserCanInvite, roleDetails} from '@faims3/data-model';
import {PhotoLightbox} from '@faims3/forms';
import QRCode from 'qrcode';
import {useEffect, useId, useMemo, useState} from 'react';
import {config} from '../../../../buildconfig';
import {selectActiveUser} from '../../../../context/slices/authSlice';
import {
  Project,
  ProjectQuickShare,
  clearProjectQuickShare,
  serverById,
  setProjectQuickShare,
} from '../../../../context/slices/projectSlice';
import {useAppDispatch, useAppSelector} from '../../../../context/store';
import {logError} from '../../../../logging';
import {useIsOnline} from '../../../../utils/customHooks';
import {useInterval} from '../../../../utils/useInterval';
import {HttpError} from '../../../../utils/apiOperations/client';
import {
  createQuickShare,
  revokeOwnQuickShares,
} from '../../../../utils/apiOperations/quickShare';
import {inviteRegisterUrl} from '../../authentication/inviteRedemption';

/** High enough that a full-width lightbox zoom still stays sharp. */
const QUICK_SHARE_QR_SIZE_PX = 2048;

function surveyRoleDescription(role: Role): string {
  return roleDetails[role].description
    .replaceAll('{notebooks}', config.notebookNamePlural)
    .replaceAll('{notebook}', config.notebookName);
}

function formatExpiry(expiry: number): string {
  return new Date(expiry).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function isNotFound(error: unknown): boolean {
  return error instanceof HttpError && error.response.status === 404;
}

/** The redemption QR is only shown to the signed-in user who generated it. */
function quickShareBelongsToUser(
  share: ProjectQuickShare | undefined,
  user: {username: string; serverId: string} | undefined,
  projectServerId: string
): share is ProjectQuickShare {
  return (
    !!share &&
    !!user &&
    user.serverId === projectServerId &&
    share.createdBy === user.username
  );
}

type QuickShareFailure = {
  kind:
    | 'not-found'
    | 'level'
    | 'disabled'
    | 'higher-role'
    | 'revoke-denied'
    | 'generic';
  message: string;
};

/**
 * The status line alone cannot tell these apart. Conductor puts the reason
 * in the JSON body, which {@link HttpError} keeps on `bodyText`.
 */
function classifyQuickShareError(error: unknown): QuickShareFailure {
  if (isNotFound(error)) {
    return {
      kind: 'not-found',
      message: 'This survey is no longer on the server.',
    };
  }
  const server = error instanceof HttpError ? error.serverMessage() : undefined;
  if (server && /disabled for this survey/i.test(server)) {
    return {
      kind: 'disabled',
      message: 'Quick share is disabled for this survey.',
    };
  }
  if (server && /above your current access/i.test(server)) {
    return {
      kind: 'higher-role',
      message:
        'A code above your current access is still active. Revoke it before generating a new one.',
    };
  }
  if (server && /not authorized to delete this invite/i.test(server)) {
    return {
      kind: 'revoke-denied',
      message: 'You are not allowed to revoke this code.',
    };
  }
  if (
    server &&
    /not authorized to share this survey at that level/i.test(server)
  ) {
    return {
      kind: 'level',
      message: 'You are not allowed to share this survey at that level.',
    };
  }
  return {
    kind: 'generic',
    message:
      'Could not update the quick share code. Check your connection and try again.',
  };
}

export default function NotebookQuickShare({
  project,
  layout = 'button',
  sx,
}: {
  project: Project;
  /**
   * `button` is the notebook header control. `settings` is a card on the
   * settings tab: heading, description, then a button that opens the same
   * dialog.
   */
  layout?: 'button' | 'settings';
  /** Styles for the header share control, so each placement can space itself. */
  sx?: SxProps<Theme>;
}) {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const wideHeader = useMediaQuery(theme.breakpoints.up('md'));
  const {isOnline, checkIsOnline} = useIsOnline();
  const activeUser = useAppSelector(selectActiveUser);
  const server = useAppSelector(state =>
    serverById(state.projects, project.serverId)
  );
  const allowedRoles = useMemo(() => {
    if (!activeUser) return [];
    return projectRolesUserCanInvite({
      decodedToken: activeUser.parsedToken,
      resourceId: project.projectId,
    });
  }, [activeUser, project.projectId]);

  const titleId = useId();
  const [role, setRole] = useState<Role | ''>('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [offerRevokeOwn, setOfferRevokeOwn] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useInterval(() => setNow(Date.now()), 30_000);

  useEffect(() => {
    if (allowedRoles.length === 0) {
      setRole('');
      return;
    }
    if (!role || !allowedRoles.includes(role)) {
      setRole(allowedRoles[0]);
    }
  }, [allowedRoles, role]);

  const storedShare = project.quickShare;
  const expired = !!storedShare && storedShare.expiry <= now;
  // An expired code is not shown. Another person's code is not shown either,
  // including an admin code this user is not allowed to grant. It stays stored
  // so its creator still has it after they sign back in. Clearing an expired
  // code puts the dialog back on the generate form.
  const share =
    !expired &&
    quickShareBelongsToUser(storedShare, activeUser, project.serverId)
      ? storedShare
      : undefined;

  useEffect(() => {
    if (!expired) return;
    setLightboxOpen(false);
    setConfirmRevoke(false);
    dispatch(
      clearProjectQuickShare({
        projectId: project.projectId,
        serverId: project.serverId,
      })
    );
  }, [dispatch, expired, project.projectId, project.serverId]);

  useEffect(() => {
    if (share) return;
    setLightboxOpen(false);
    setConfirmRevoke(false);
  }, [share]);

  if (
    project.disableQuickShare ||
    !project.isActivated ||
    !activeUser ||
    allowedRoles.length === 0
  ) {
    return null;
  }

  const rememberShare = (next: ProjectQuickShare) => {
    dispatch(
      setProjectQuickShare({
        projectId: project.projectId,
        serverId: project.serverId,
        quickShare: next,
      })
    );
  };

  const forgetShare = () => {
    dispatch(
      clearProjectQuickShare({
        projectId: project.projectId,
        serverId: project.serverId,
      })
    );
  };

  const reportFailure = (caught: unknown) => {
    const failure = classifyQuickShareError(caught);
    setOfferRevokeOwn(failure.kind === 'higher-role');
    setError(failure.message);
  };

  const handleGenerate = async () => {
    setError(undefined);
    setOfferRevokeOwn(false);
    if (share) {
      return;
    }
    if (!checkIsOnline()) {
      setError('Quick share needs a connection to the server.');
      return;
    }
    if (!server || role === '') {
      return;
    }
    setWorking(true);
    try {
      const invite = await createQuickShare({
        serverId: project.serverId,
        username: activeUser.username,
        projectId: project.projectId,
        role,
      });
      const qrCode = await QRCode.toDataURL(
        inviteRegisterUrl({
          serverUrl: server.serverUrl,
          inviteId: invite._id,
        }),
        {width: QUICK_SHARE_QR_SIZE_PX, margin: 2}
      );
      rememberShare({
        inviteId: invite._id,
        role: invite.role,
        expiry: invite.expiry,
        qrCode,
        createdBy: activeUser.username,
      });
    } catch (caught) {
      logError(
        caught instanceof Error ? caught : new Error('Quick share failed')
      );
      reportFailure(caught);
    } finally {
      setWorking(false);
    }
  };

  const handleRevokeOwn = async () => {
    setError(undefined);
    if (!checkIsOnline()) {
      setError('Revoking your code needs a connection to the server.');
      return;
    }
    setWorking(true);
    try {
      await revokeOwnQuickShares({
        serverId: project.serverId,
        username: activeUser.username,
        projectId: project.projectId,
      });
      forgetShare();
      setOfferRevokeOwn(false);
    } catch (caught) {
      if (isNotFound(caught)) {
        forgetShare();
        setOfferRevokeOwn(false);
      } else {
        logError(
          caught instanceof Error
            ? caught
            : new Error('Quick share revoke failed')
        );
        reportFailure(caught);
      }
    } finally {
      setWorking(false);
    }
  };

  const handleRevoke = async () => {
    if (!share) {
      return;
    }
    setError(undefined);
    setOfferRevokeOwn(false);
    if (!checkIsOnline()) {
      setError('Generating a new code needs a connection to the server.');
      return;
    }
    setWorking(true);
    try {
      await revokeOwnQuickShares({
        serverId: project.serverId,
        username: activeUser.username,
        projectId: project.projectId,
      });
      forgetShare();
      setConfirmRevoke(false);
      setLightboxOpen(false);
    } catch (caught) {
      // Nothing left to revoke. Drop the local copy so a new code can be made.
      if (isNotFound(caught)) {
        forgetShare();
        setConfirmRevoke(false);
        setLightboxOpen(false);
      } else {
        logError(
          caught instanceof Error
            ? caught
            : new Error('Quick share revoke failed')
        );
        reportFailure(caught);
      }
    } finally {
      setWorking(false);
    }
  };

  const closeDialog = () => {
    if (working) return;
    setLightboxOpen(false);
    setDialogOpen(false);
  };

  const headerSx = [{flexShrink: 0}, ...(Array.isArray(sx) ? sx : [sx])];
  const openShare = () => setDialogOpen(true);
  const headerControl = wideHeader ? (
    <Button
      variant="contained"
      disableElevation
      startIcon={<ShareIcon />}
      onClick={openShare}
      data-testid="app-quick-share-open"
      sx={[{textTransform: 'none'}, ...headerSx]}
    >
      Share
    </Button>
  ) : (
    <Tooltip title="Share">
      <IconButton
        aria-label="Share"
        size="small"
        onClick={openShare}
        data-testid="app-quick-share-open"
        sx={[
          {
            bgcolor: 'grey.300',
            color: 'text.primary',
            '&:hover': {bgcolor: 'grey.400'},
          },
          ...headerSx,
        ]}
      >
        <ShareIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );

  return (
    <>
      {layout === 'settings' ? (
        <SettingsQuickShare onOpen={openShare} />
      ) : (
        headerControl
      )}

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        fullWidth
        maxWidth="xs"
        aria-labelledby={titleId}
        data-testid="app-quick-share"
      >
        <DialogTitle
          component="div"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 2,
            pr: 6,
            pb: 1.5,
          }}
        >
          <Typography id={titleId} component="h2" variant="h4">
            Share this {config.notebookName}
          </Typography>
          {share && (
            <Button
              size="small"
              variant="outlined"
              disabled={!isOnline || working}
              onClick={() => setConfirmRevoke(true)}
              data-testid="app-quick-share-revoke"
              sx={{textTransform: 'none', flexShrink: 0}}
            >
              Start again
            </Button>
          )}
          <IconButton
            aria-label="Close"
            onClick={closeDialog}
            disabled={working}
            className="faims-dialogCloseButton"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{pt: 1.5, pb: 3}}>
          {share ? (
            <ActiveQuickShare
              share={share}
              isOnline={isOnline}
              error={error}
              aboveAccess={!allowedRoles.includes(share.role)}
              onOpenLightbox={() => setLightboxOpen(true)}
            />
          ) : (
            <GenerateQuickShare
              role={role}
              isOnline={isOnline}
              working={working}
              error={error}
              offerRevokeOwn={offerRevokeOwn}
              onRole={setRole}
              onGenerate={handleGenerate}
              onRevokeOwn={handleRevokeOwn}
              allowedRoles={allowedRoles}
            />
          )}
        </DialogContent>
      </Dialog>

      {lightboxOpen && share && (
        <PhotoLightbox
          url={share.qrCode}
          fit="width"
          onClose={() => setLightboxOpen(false)}
        />
      )}

      <Dialog
        open={confirmRevoke}
        onClose={() => {
          if (!working) setConfirmRevoke(false);
        }}
      >
        <DialogTitle>Start again?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            The current code will no longer grant access for new users. You can
            generate a new one afterwards.
          </Typography>
          {error && (
            <Alert severity="error" sx={{mt: 2}}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions
          disableSpacing
          sx={theme => ({
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            gap: 1,
            [theme.breakpoints.down('sm')]: {
              flexDirection: 'column-reverse',
              alignItems: 'stretch',
            },
          })}
        >
          <Button
            onClick={() => setConfirmRevoke(false)}
            disabled={working}
            data-testid="app-quick-share-revoke-cancel"
            sx={{textTransform: 'none'}}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleRevoke}
            disabled={working || !isOnline}
            data-testid="app-quick-share-revoke-confirm"
            sx={{textTransform: 'none'}}
          >
            {working ? 'Working…' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function SettingsQuickShare({onOpen}: {onOpen: () => void}) {
  return (
    <Box
      component={Paper}
      variant="outlined"
      elevation={0}
      sx={{p: 2, mb: {xs: 1, sm: 2, md: 3}}}
      data-testid="app-quick-share-settings"
    >
      <Typography variant="h6" sx={{mb: 2}}>
        Quick share
      </Typography>
      <Box>
        <Typography variant="body2" sx={{mb: 2}}>
          Share this {config.notebookName} with another user by generating a
          temporary QR code.
        </Typography>
        <Button
          variant="outlined"
          color="primary"
          onClick={onOpen}
          data-testid="app-quick-share-open"
        >
          Share this {config.notebookName}
        </Button>
      </Box>
    </Box>
  );
}

function MetadataPair({
  label,
  value,
  valueTestId,
}: {
  label: string;
  value: string;
  valueTestId: string;
}) {
  return (
    <Box>
      <Typography
        variant="subtitle2"
        sx={theme => ({
          fontWeight: theme.typography.fontWeightBold,
          lineHeight: 1.3,
        })}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        data-testid={valueTestId}
        sx={{fontSize: '0.8125rem', lineHeight: 1.35}}
      >
        {value}
      </Typography>
    </Box>
  );
}

function ActiveQuickShare({
  share,
  isOnline,
  error,
  aboveAccess,
  onOpenLightbox,
}: {
  share: ProjectQuickShare;
  isOnline: boolean;
  error: string | undefined;
  aboveAccess: boolean;
  onOpenLightbox: () => void;
}) {
  const roleName = roleDetails[share.role].name;
  return (
    <Stack spacing={2.5} data-testid="app-quick-share-result">
      {!isOnline && (
        <Alert severity="warning" data-testid="app-quick-share-offline">
          You can keep showing this code. Generating a new one needs a
          connection to the server.
        </Alert>
      )}
      {aboveAccess && (
        <Alert severity="warning" data-testid="app-quick-share-above-access">
          This code is above your current access. Generating a new code will
          revoke it.
        </Alert>
      )}

      <Stack spacing={3}>
        <Box
          sx={{
            p: 2,
            borderRadius: 1,
            bgcolor: 'action.hover',
          }}
          data-testid="app-quick-share-summary"
        >
          <Stack spacing={2}>
            <MetadataPair
              label="Access level"
              value={roleName}
              valueTestId="app-quick-share-role-label"
            />
            <MetadataPair
              label="Expires"
              value={formatExpiry(share.expiry)}
              valueTestId="app-quick-share-expiry"
            />
          </Stack>
        </Box>

        <Stack spacing={1.5} sx={{alignItems: 'center'}}>
          <Typography id={'instructions'} component="p" variant="body2">
            Ask the user to scan the QR code below, using the app, to grant them
            access to this {config.notebookName}.
          </Typography>
          <Box
            component="button"
            type="button"
            onClick={onOpenLightbox}
            aria-label="Enlarge QR code"
            data-testid="app-quick-share-qr"
            sx={{
              display: 'block',
              width: '100%',
              maxWidth: 220,
              border: 0,
              p: 0,
              bgcolor: 'background.paper',
              cursor: 'pointer',
              lineHeight: 0,
            }}
          >
            <Box
              component="img"
              src={share.qrCode}
              alt={`Quick share QR code for ${roleName} access`}
              sx={{
                display: 'block',
                width: '100%',
                height: 'auto',
                maxWidth: '100%',
                aspectRatio: '1',
              }}
            />
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{textAlign: 'center', lineHeight: 1.3}}
          >
            Tap the code to enlarge it for scanning.
          </Typography>
        </Stack>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}

function RoleSelectItem({role}: {role: Role}) {
  return (
    <Box sx={{display: 'flex', flexDirection: 'column', minWidth: 0, py: 0.25}}>
      <Typography variant="body2" sx={{fontWeight: 600, lineHeight: 1.3}}>
        {roleDetails[role].name}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{whiteSpace: 'normal', lineHeight: 1.35}}
      >
        {surveyRoleDescription(role)}
      </Typography>
    </Box>
  );
}

function GenerateQuickShare({
  role,
  isOnline,
  working,
  error,
  offerRevokeOwn,
  allowedRoles,
  onRole,
  onGenerate,
  onRevokeOwn,
}: {
  role: Role | '';
  isOnline: boolean;
  working: boolean;
  error: string | undefined;
  offerRevokeOwn: boolean;
  allowedRoles: Role[];
  onRole: (role: Role) => void;
  onGenerate: () => void;
  onRevokeOwn: () => void;
}) {
  return (
    <Stack spacing={2.5}>
      <Typography variant="body2">
        The user will be granted the role selected below.
      </Typography>

      {!isOnline && (
        <Alert severity="warning" data-testid="app-quick-share-offline">
          You cannot generate invites without an internet connection.
        </Alert>
      )}

      <FormControl fullWidth size="small" disabled={!isOnline || working}>
        <InputLabel id="quick-share-role-label">Access role</InputLabel>
        <Select
          labelId="quick-share-role-label"
          label="Access role"
          value={role}
          onChange={event => onRole(event.target.value as Role)}
          data-testid="app-quick-share-role"
          renderValue={selected => roleDetails[selected].name}
        >
          {allowedRoles.map(allowed => (
            <MenuItem
              key={allowed}
              value={allowed}
              sx={{whiteSpace: 'normal', alignItems: 'flex-start', py: 1}}
            >
              <RoleSelectItem role={allowed} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Button
        variant="contained"
        startIcon={<QrCode2Icon />}
        disabled={!isOnline || working || role === ''}
        onClick={onGenerate}
        data-testid="app-quick-share-generate"
        sx={{textTransform: 'none', alignSelf: 'flex-start'}}
      >
        {working ? 'Creating…' : 'Generate QR code'}
      </Button>

      {offerRevokeOwn && (
        <Button
          variant="outlined"
          color="error"
          disabled={!isOnline || working}
          onClick={onRevokeOwn}
          data-testid="app-quick-share-revoke-own"
          sx={{textTransform: 'none', alignSelf: 'flex-start'}}
        >
          Revoke your code
        </Button>
      )}

      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}
