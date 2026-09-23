/**
 * @file Notebook schema compatibility UI: list chip, degraded banner, and the
 * fail-soft skeleton shown when a notebook's design cannot be interpreted by
 * this build (newer major schema, failed migration, invalid document, or a
 * compile failure). Replaces the former infinite "Loading" spinner.
 */

import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  ProjectStatus,
  type NotebookSchemaCompatibility,
} from '@faims3/data-model';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import UpdateIcon from '@mui/icons-material/SystemUpdateAlt';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {useCallback, useMemo, useState} from 'react';
import {config} from '../../../buildconfig';
import {type Project} from '../../../context/slices/projectSlice';
import {useAppSelector} from '../../../context/store';
import {MetadataDisplayComponent} from './MetadataDisplay';

/** Short label + colour for a non-compatible tier; `undefined` for compatible. */
export function compatibilityChipProps(
  compatibility: NotebookSchemaCompatibility | undefined
): {label: string; color: 'warning' | 'error'; title: string} | undefined {
  if (!compatibility) return undefined;
  if (compatibility.tier === 'incompatible') {
    return {
      label: 'Needs app update',
      color: 'error',
      title: compatibility.reason,
    };
  }
  if (compatibility.tier === 'degraded') {
    return {
      label: 'Limited support',
      color: 'warning',
      title: compatibility.reason,
    };
  }
  return undefined;
}

/** Small chip for notebook lists; renders nothing when compatible. */
export function NotebookSchemaCompatibilityChip({
  compatibility,
}: {
  compatibility: NotebookSchemaCompatibility | undefined;
}) {
  const props = compatibilityChipProps(compatibility);
  if (!props) return null;
  return (
    <Chip
      size="small"
      color={props.color}
      variant="outlined"
      icon={
        props.color === 'error' ? (
          <UpdateIcon fontSize="small" />
        ) : (
          <WarningAmberIcon fontSize="small" />
        )
      }
      label={props.label}
      title={props.title}
      data-testid={`notebook-schema-chip-${compatibility?.tier}`}
      sx={{maxWidth: '100%'}}
    />
  );
}

/**
 * Plain-text diagnostic a user can paste into a support request. Includes
 * everything needed to reproduce: ids, raw and expected schema versions, app
 * and server versions, tier and reason.
 */
export function buildNotebookCompatibilityReport({
  project,
  serverVersion,
  compatibility,
  extraReason,
}: {
  project: Pick<
    Project,
    'projectId' | 'serverId' | 'name' | 'uiSpecificationId' | 'status'
  >;
  serverVersion?: string;
  compatibility?: NotebookSchemaCompatibility;
  /** Additional failure detail (e.g. compile error) when the tier alone is not the cause. */
  extraReason?: string;
}): string {
  const lines = [
    `${config.notebookNameCapitalized} compatibility report`,
    `Generated: ${new Date().toISOString()}`,
    `${config.notebookNameCapitalized}: ${project.name}`,
    `${config.notebookNameCapitalized} id: ${project.projectId}`,
    `Server id: ${project.serverId}`,
    `Status: ${project.status}`,
    `${config.notebookNameCapitalized} schemaVersion: ${
      compatibility?.notebookSchemaVersion ?? 'unknown'
    }`,
    `App schemaVersion: ${
      compatibility?.appSchemaVersion ?? CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
    }`,
    `App version: ${config.appVersion}`,
    `Server version: ${serverVersion ?? 'unknown'}`,
    `Tier: ${compatibility?.tier ?? 'incompatible'}`,
    `Relation: ${compatibility?.relation ?? 'unknown'}`,
    `Reason: ${compatibility?.reason ?? extraReason ?? 'unknown'}`,
  ];
  if (extraReason && compatibility?.reason !== extraReason) {
    lines.push(`Detail: ${extraReason}`);
  }
  lines.push(`Compiled spec id: ${project.uiSpecificationId}`);
  return lines.join('\n');
}

/** Copy `text` to the clipboard with a legacy fallback; resolves true on success. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/** Monospace report block with a copy button. */
export function CopyableCompatibilityReport({report}: {report: string}) {
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const onCopy = useCallback(async () => {
    const ok = await copyText(report);
    setCopied(ok ? 'done' : 'failed');
    setTimeout(() => setCopied('idle'), 2500);
  }, [report]);

  return (
    <Paper variant="outlined" sx={{p: 2}}>
      <Stack
        direction="row"
        sx={{justifyContent: 'space-between', alignItems: 'center', mb: 1}}
      >
        <Typography variant="subtitle2">Diagnostic report</Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ContentCopyIcon fontSize="small" />}
          onClick={onCopy}
          data-testid="notebook-compatibility-copy-report"
        >
          {copied === 'done'
            ? 'Copied'
            : copied === 'failed'
              ? 'Copy failed — select text'
              : 'Copy report'}
        </Button>
      </Stack>
      <Box
        component="pre"
        data-testid="notebook-compatibility-report"
        sx={{
          m: 0,
          p: 1.5,
          fontSize: '0.75rem',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          bgcolor: 'grey.100',
          borderRadius: 1,
          userSelect: 'all',
        }}
      >
        {report}
      </Box>
    </Paper>
  );
}

/** Banner for the `degraded` tier, shown above a best-effort render. */
export function NotebookSchemaDegradedAlert({
  compatibility,
}: {
  compatibility: NotebookSchemaCompatibility;
}) {
  return (
    <Alert severity="warning" data-testid="notebook-schema-degraded-alert">
      <AlertTitle>
        This {config.notebookName} uses a newer format than this app
      </AlertTitle>
      {config.notebookNameCapitalized} schema{' '}
      <b>{compatibility.notebookSchemaVersion}</b> vs app schema{' '}
      <b>{compatibility.appSchemaVersion}</b> (app version {config.appVersion}
      ). Some fields or features may not display or save correctly. Update the
      app for full support.
    </Alert>
  );
}

/**
 * Fail-soft skeleton for a notebook whose design this build cannot safely
 * render: title/status context, an explanation, a copyable diagnostic, and
 * the design metadata when it could be salvaged. Activation is left alone so
 * local data is not trapped.
 *
 * - `variant="full"` (default): no usable local design — shows the metadata
 *   block and a "records unavailable" notice.
 * - `variant="header"`: a last good design is available locally, so the
 *   caller renders a read-only record list beneath this banner. Create and
 *   edit remain blocked (see `isNotebookDesignLocked`).
 */
export function NotebookSchemaIncompatibleView({
  project,
  compatibility,
  extraReason,
  variant = 'full',
}: {
  project: Project;
  compatibility?: NotebookSchemaCompatibility;
  /** Compile or other failure detail when `compatibility` alone is not the cause. */
  extraReason?: string;
  variant?: 'full' | 'header';
}) {
  const withRecords = variant === 'header';
  const serverVersion = useAppSelector(
    state => state.projects.servers[project.serverId]?.serverVersion
  );

  const report = useMemo(
    () =>
      buildNotebookCompatibilityReport({
        project,
        serverVersion,
        compatibility,
        extraReason,
      }),
    [project, serverVersion, compatibility, extraReason]
  );

  const isNewerMajor = compatibility?.relation === 'newer-major';
  const hasMetadata =
    !!project.uiDefinition?.metadata?.information &&
    Object.values(project.uiDefinition.metadata.information).some(
      v => typeof v === 'string' && v.trim() !== ''
    );

  return (
    <Stack spacing={2} data-testid="notebook-schema-incompatible-view">
      <Stack direction="row" spacing={1} sx={{alignItems: 'center'}}>
        <Chip
          size="small"
          label={
            project.status === ProjectStatus.OPEN ? 'Open' : project.status
          }
          variant="outlined"
        />
        <NotebookSchemaCompatibilityChip
          compatibility={
            compatibility ?? {
              tier: 'incompatible',
              relation: 'current',
              appSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
              requiresMigration: false,
              reason: extraReason ?? 'Unavailable',
            }
          }
        />
      </Stack>

      <Alert severity="error">
        <AlertTitle>
          This {config.notebookName} cannot be opened with this version of the
          app
        </AlertTitle>
        <Typography variant="body2" sx={{mb: 1}}>
          {compatibility?.reason ?? extraReason}
        </Typography>
        {extraReason && compatibility?.reason !== extraReason && (
          <Typography variant="body2" sx={{mb: 1}}>
            {extraReason}
          </Typography>
        )}
        <Typography variant="body2">
          {isNewerMajor
            ? `Update the app to a version that supports ${config.notebookName} schema ${compatibility?.notebookSchemaVersion}. `
            : `Contact the ${config.notebookName} owner or a system administrator with the report below. `}
          {withRecords
            ? `Records already on this device are kept, will continue to sync, and can be viewed below using the last design this app understood; creating or editing records is disabled until the ${config.notebookName} can be loaded.`
            : `Records already on this device are kept and will continue to sync; creating new records is disabled until the ${config.notebookName} can be loaded.`}
        </Typography>
      </Alert>

      <CopyableCompatibilityReport report={report} />

      {!withRecords && hasMetadata && (
        <Paper variant="outlined" sx={{p: 1}}>
          <MetadataDisplayComponent
            project={project}
            templateId={project.templateId}
          />
        </Paper>
      )}

      {!withRecords && (
        <Paper variant="outlined" sx={{p: 2}}>
          <Typography variant="subtitle2" gutterBottom>
            Records
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The record list is unavailable because the {config.notebookName}{' '}
            design could not be loaded.
          </Typography>
        </Paper>
      )}
    </Stack>
  );
}

/** Short banner for record pages when the design is locked (view allowed, edit blocked). */
export function NotebookDesignLockedAlert({
  compatibility,
}: {
  compatibility?: NotebookSchemaCompatibility;
}) {
  return (
    <Alert severity="warning" data-testid="notebook-design-locked-alert">
      <AlertTitle>
        This {config.notebookName} cannot be edited with this version of the app
      </AlertTitle>
      {compatibility?.reason ??
        `The ${config.notebookName} design could not be loaded.`}{' '}
      Records can be viewed but not changed until the {config.notebookName} can
      be loaded.
    </Alert>
  );
}
