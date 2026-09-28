/**
 * Quick Share: one temporary QR code for an activated survey.
 *
 * Generate stores the code on the project. The panel then only shows that
 * code — its role, when it expires, and a tap-to-enlarge QR — until the user
 * revokes it. Revoke deletes the invite, then the generate form comes back.
 */

import QrCode2Icon from '@mui/icons-material/QrCode2';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  DEFAULT_QUICK_SHARE_LIFETIME_MS,
  QUICK_SHARE_LIFETIME_OPTIONS,
  Role,
  projectRolesUserCanInvite,
  roleDetails,
} from '@faims3/data-model';
import {PhotoLightbox} from '@faims3/forms';
import QRCode from 'qrcode';
import {useEffect, useMemo, useState} from 'react';
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

export default function NotebookQuickShare({project}: {project: Project}) {
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

  const [role, setRole] = useState<Role | ''>('');
  const [lifetimeMs, setLifetimeMs] = useState(DEFAULT_QUICK_SHARE_LIFETIME_MS);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [showCode, setShowCode] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
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

  const share = project.quickShare;
  const expired = !!share && share.expiry <= now;

  if (!project.isActivated || !activeUser || allowedRoles.length === 0) {
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
        lifetimeMs,
      });
      const qrCode = await QRCode.toDataURL(
        inviteRegisterUrl({
          serverUrl: server.serverUrl,
          inviteId: invite._id,
        })
      );
      rememberShare({
        inviteId: invite._id,
        role: invite.role,
        expiry: invite.expiry,
        qrCode,
      });
      setShowCode(false);
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
      setError('Revoking a quick share needs a connection to the server.');
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
      setShowCode(false);
    } catch (caught) {
      const message = quickShareErrorMessage(caught);
      // Already gone on the server: drop the local copy so a new one can be made.
      if (!message) {
        forgetShare();
        setConfirmRevoke(false);
        setLightboxOpen(false);
        setShowCode(false);
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

  return (
    <Box
      component={Paper}
      variant="outlined"
      elevation={0}
      sx={{p: 2, mb: {xs: 1, sm: 2, md: 3}}}
      data-testid="app-quick-share"
    >
      <Typography variant="h6" sx={{mb: 1}}>
        Quick share
      </Typography>

      {share ? (
        <ActiveQuickShare
          share={share}
          expired={expired}
          isOnline={isOnline}
          working={working}
          showCode={showCode}
          error={error}
          onToggleCode={() => setShowCode(open => !open)}
          onOpenLightbox={() => setLightboxOpen(true)}
          onAskRevoke={() => setConfirmRevoke(true)}
        />
      ) : (
        <GenerateQuickShare
          role={role}
          lifetimeMs={lifetimeMs}
          isOnline={isOnline}
          working={working}
          error={error}
          onRole={setRole}
          onLifetime={setLifetimeMs}
          onGenerate={handleGenerate}
          allowedRoles={allowedRoles}
        />
      )}

      {lightboxOpen && share && !expired && (
        <PhotoLightbox
          url={share.qrCode}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      <Dialog
        open={confirmRevoke}
        onClose={() => {
          if (!working) setConfirmRevoke(false);
        }}
      >
        <DialogTitle>Revoke this quick share?</DialogTitle>
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
            color="error"
            onClick={handleRevoke}
            disabled={working || !isOnline}
            data-testid="app-quick-share-revoke-confirm"
          >
            {working ? 'Revoking…' : 'Revoke'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ActiveQuickShare({
  share,
  expired,
  isOnline,
  working,
  showCode,
  error,
  onToggleCode,
  onOpenLightbox,
  onAskRevoke,
}: {
  share: ProjectQuickShare;
  expired: boolean;
  isOnline: boolean;
  working: boolean;
  showCode: boolean;
  error: string | undefined;
  onToggleCode: () => void;
  onOpenLightbox: () => void;
  onAskRevoke: () => void;
}) {
  const roleName = roleDetails[share.role].name;
  return (
    <Stack spacing={2} data-testid="app-quick-share-result">
      <Typography variant="body2">
        {expired
          ? `This code for ${config.notebookName} access has expired. Revoke it before you generate another.`
          : `Show this code to give someone ${roleName.toLowerCase()} access. Revoke it before you generate another.`}
      </Typography>

      {!isOnline && (
        <Alert severity="warning" data-testid="app-quick-share-offline">
          You can keep showing this code. Revoking it needs a connection to the
          server.
        </Alert>
      )}

      <Box
        sx={{
          p: 1.5,
          borderRadius: 1,
          bgcolor: 'action.hover',
        }}
        data-testid="app-quick-share-summary"
      >
        <Typography variant="body2" color="text.secondary">
          Access level
        </Typography>
        <Typography
          variant="subtitle1"
          data-testid="app-quick-share-role-label"
        >
          {roleName}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{mt: 1}}>
          {expired ? 'Expired' : 'Expires'}
        </Typography>
        <Typography
          variant="subtitle1"
          color={expired ? 'error' : 'text.primary'}
          data-testid="app-quick-share-expiry"
        >
          {formatExpiry(share.expiry)}
        </Typography>
      </Box>

      {!expired && (
        <Stack spacing={0.5} sx={{alignItems: 'center'}}>
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
          <Typography variant="body2" color="text.secondary">
            Tap the code to enlarge it for scanning.
          </Typography>
        </Stack>
      )}

      <Button
        size="small"
        onClick={onToggleCode}
        data-testid="app-quick-share-show-code"
        sx={{textTransform: 'none', alignSelf: 'flex-start'}}
      >
        {showCode ? 'Hide code' : 'Show code'}
      </Button>
      {showCode && (
        <Typography
          variant="body2"
          sx={{fontFamily: 'monospace', wordBreak: 'break-all'}}
          data-testid="app-quick-share-code"
        >
          {share.inviteId}
        </Typography>
      )}

      <Button
        variant="outlined"
        color="error"
        disabled={!isOnline || working}
        onClick={onAskRevoke}
        data-testid="app-quick-share-revoke"
        sx={{textTransform: 'none', alignSelf: 'flex-start'}}
      >
        {expired ? 'Revoke and start again' : 'Revoke'}
      </Button>

      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}

function GenerateQuickShare({
  role,
  lifetimeMs,
  isOnline,
  working,
  error,
  allowedRoles,
  onRole,
  onLifetime,
  onGenerate,
}: {
  role: Role | '';
  lifetimeMs: number;
  isOnline: boolean;
  working: boolean;
  error: string | undefined;
  allowedRoles: Role[];
  onRole: (role: Role) => void;
  onLifetime: (lifetimeMs: number) => void;
  onGenerate: () => void;
}) {
  return (
    <Stack spacing={2}>
      <Typography variant="body2">
        Generate a temporary QR code for this {config.notebookName}. Someone
        else scans it the same way they scan an invite. If they are already
        signed in, they get access immediately. Otherwise they can register.
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
        >
          {allowedRoles.map(allowed => (
            <MenuItem key={allowed} value={allowed}>
              {roleDetails[allowed].name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {role !== '' && (
        <Typography variant="body2" color="text.secondary">
          {surveyRoleDescription(role)}
        </Typography>
      )}

      <ToggleButtonGroup
        exclusive
        size="small"
        value={String(lifetimeMs)}
        disabled={!isOnline || working}
        onChange={(_event, value: string | null) => {
          if (value) onLifetime(Number(value));
        }}
        aria-label="How long the code lasts"
        data-testid="app-quick-share-lifetime"
        sx={{flexWrap: 'wrap'}}
      >
        {QUICK_SHARE_LIFETIME_OPTIONS.map(option => (
          <ToggleButton key={option.ms} value={String(option.ms)}>
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

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
