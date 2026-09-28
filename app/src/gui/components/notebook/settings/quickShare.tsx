/**
 * Quick Share: one temporary QR code for an activated survey.
 *
 * A Share button opens a dialog. Generate stores the code on the project. The
 * dialog then only shows that code — its role, when it expires, and a
 * tap-to-enlarge QR — until the user generates a new one. That deletes the
 * invite, then the generate form comes back. Every code lasts one hour. An
 * expired code is dropped, and the dialog shows the generate form again.
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
  Select,
  Stack,
  Typography,
} from '@mui/material';
import type {SxProps, Theme} from '@mui/material/styles';
import {
  DEFAULT_QUICK_SHARE_LIFETIME_MS,
  Role,
  projectRolesUserCanInvite,
  roleDetails,
} from '@faims3/data-model';
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
import {
  createQuickShare,
  revokeQuickShare,
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

function quickShareErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/401|403|not authorized|not allowed/i.test(message)) {
    return 'You are not allowed to share this survey at that level.';
  }
  if (/\b404\b/.test(message)) {
    return '';
  }
  return 'Could not update the quick share code. Check your connection and try again.';
}

export default function NotebookQuickShare({
  project,
  sx,
}: {
  project: Project;
  /** Styles for the Share button, so each placement can space itself. */
  sx?: SxProps<Theme>;
}) {
  const dispatch = useAppDispatch();
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

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
  // An expired code is not shown. Clearing it puts the dialog back on the
  // generate form the next time it opens, including after a revisit.
  const share = expired ? undefined : storedShare;

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

  const handleGenerate = async () => {
    setError(undefined);
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
        lifetimeMs: DEFAULT_QUICK_SHARE_LIFETIME_MS,
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
      });
    } catch (caught) {
      logError(
        caught instanceof Error ? caught : new Error('Quick share failed')
      );
      setError(quickShareErrorMessage(caught));
    } finally {
      setWorking(false);
    }
  };

  const handleRevoke = async () => {
    if (!share) {
      return;
    }
    setError(undefined);
    if (!checkIsOnline()) {
      setError('Generating a new code needs a connection to the server.');
      return;
    }
    setWorking(true);
    try {
      await revokeQuickShare({
        serverId: project.serverId,
        username: activeUser.username,
        projectId: project.projectId,
        inviteId: share.inviteId,
      });
      forgetShare();
      setConfirmRevoke(false);
      setLightboxOpen(false);
    } catch (caught) {
      const message = quickShareErrorMessage(caught);
      // Already gone on the server: drop the local copy so a new one can be made.
      if (!message) {
        forgetShare();
        setConfirmRevoke(false);
        setLightboxOpen(false);
      } else {
        logError(
          caught instanceof Error
            ? caught
            : new Error('Quick share revoke failed')
        );
        setError(message);
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

  return (
    <>
      <Button
        variant="contained"
        disableElevation
        startIcon={<ShareIcon />}
        onClick={() => setDialogOpen(true)}
        data-testid="app-quick-share-open"
        sx={[
          {textTransform: 'none', flexShrink: 0},
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        Share
      </Button>

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        fullWidth
        maxWidth="sm"
        aria-labelledby={titleId}
        data-testid="app-quick-share"
      >
        <DialogTitle
          component="div"
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
            pr: 6,
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
              Generate a new code
            </Button>
          )}
          <IconButton
            aria-label="Close"
            onClick={closeDialog}
            disabled={working}
            sx={{position: 'absolute', right: 8, top: 8}}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {share ? (
            <ActiveQuickShare
              share={share}
              isOnline={isOnline}
              error={error}
              onOpenLightbox={() => setLightboxOpen(true)}
            />
          ) : (
            <GenerateQuickShare
              role={role}
              isOnline={isOnline}
              working={working}
              error={error}
              onRole={setRole}
              onGenerate={handleGenerate}
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
        <DialogTitle>Generate a new code?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This code will stop working. You can generate a new one afterwards.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmRevoke(false)}
            disabled={working}
            data-testid="app-quick-share-revoke-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRevoke}
            disabled={working || !isOnline}
            data-testid="app-quick-share-revoke-confirm"
          >
            {working ? 'Working…' : 'Generate a new code'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
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
      <Typography variant="subtitle2" sx={{fontWeight: 700, lineHeight: 1.3}}>
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
  onOpenLightbox,
}: {
  share: ProjectQuickShare;
  isOnline: boolean;
  error: string | undefined;
  onOpenLightbox: () => void;
}) {
  const roleName = roleDetails[share.role].name;
  return (
    <Stack spacing={1} data-testid="app-quick-share-result">
      {!isOnline && (
        <Alert severity="warning" data-testid="app-quick-share-offline">
          You can keep showing this code. Generating a new one needs a
          connection to the server.
        </Alert>
      )}

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            p: 1.25,
            borderRadius: 1,
            bgcolor: 'action.hover',
            flex: '1 1 16rem',
            minWidth: 0,
          }}
          data-testid="app-quick-share-summary"
        >
          <Stack spacing={0.75}>
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

        <Stack
          spacing={0.25}
          sx={{alignItems: 'center', flex: '0 0 auto', mx: 'auto'}}
        >
          <Box
            component="button"
            type="button"
            onClick={onOpenLightbox}
            aria-label="Enlarge QR code"
            data-testid="app-quick-share-qr"
            sx={{
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
              sx={{width: 220, height: 220}}
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
      </Box>

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
  allowedRoles,
  onRole,
  onGenerate,
}: {
  role: Role | '';
  isOnline: boolean;
  working: boolean;
  error: string | undefined;
  allowedRoles: Role[];
  onRole: (role: Role) => void;
  onGenerate: () => void;
}) {
  return (
    <Stack spacing={1.25}>
      <Typography variant="body2">
        Grant another user access to this survey, at the chosen level of access.
        The code lasts 1 hour.
      </Typography>

      {!isOnline && (
        <Alert severity="warning" data-testid="app-quick-share-offline">
          Quick share needs a connection to the server.
        </Alert>
      )}

      <FormControl fullWidth size="small" disabled={!isOnline || working}>
        <InputLabel id="quick-share-role-label">Access level</InputLabel>
        <Select
          labelId="quick-share-role-label"
          label="Access level"
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

      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}
