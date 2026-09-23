import {beforeEach, describe, expect, it, vi} from 'vitest';

vi.mock('@bugsnag/js', () => ({
  default: {
    start: vi.fn(),
    notify: vi.fn(),
    getPlugin: vi.fn(() => undefined),
    leaveBreadcrumb: vi.fn(),
    addMetadata: vi.fn(),
  },
}));

vi.mock('@bugsnag/plugin-react', () => ({
  default: class BugsnagPluginReact {},
}));

vi.mock('./buildconfig', () => ({
  config: {
    bugsnagKey: 'a-real-key',
    appVersion: '1.2.3',
    debugApp: false,
  },
}));

import Bugsnag from '@bugsnag/js';
import {
  reportAppServerVersionMismatch,
  reportNotebookCompileFailure,
  reportNotebookSchemaCompatibility,
  resetCompatibilityReportDedupe,
} from './logging';

type NotifyCb = (event: {
  severity?: string;
  context?: string;
  addMetadata: (section: string, data: unknown) => void;
}) => void;

function lastNotifyEvent() {
  const calls = vi.mocked(Bugsnag.notify).mock.calls;
  const [error, cb] = calls[calls.length - 1] as unknown as [Error, NotifyCb];
  const metadata: Record<string, unknown> = {};
  const event = {
    severity: undefined as string | undefined,
    context: undefined as string | undefined,
    addMetadata: (section: string, data: unknown) => {
      metadata[section] = data;
    },
  };
  cb(event);
  return {error, event, metadata};
}

describe('compatibility reporting', () => {
  beforeEach(() => {
    vi.mocked(Bugsnag.notify).mockClear();
    resetCompatibilityReportDedupe();
  });

  it('does not report compatible notebooks', () => {
    reportNotebookSchemaCompatibility({
      compatibility: {
        tier: 'compatible',
        relation: 'legacy',
        appSchemaVersion: '1.0.0',
        notebookSchemaVersion: '7.0',
        requiresMigration: true,
        reason: 'fine',
      },
      projectId: 'p',
      serverId: 's',
      source: 'test',
    });
    expect(Bugsnag.notify).not.toHaveBeenCalled();
  });

  it('reports incompatible as error with structured metadata incl. versions', () => {
    reportNotebookSchemaCompatibility({
      compatibility: {
        tier: 'incompatible',
        relation: 'newer-major',
        appSchemaVersion: '1.0.0',
        notebookSchemaVersion: '2.0.0',
        requiresMigration: false,
        reason: 'Newer major',
      },
      projectId: 'nb-1',
      serverId: 'srv',
      serverVersion: '9.9.9',
      notebookName: 'Notebook',
      source: 'app-ingest',
    });

    expect(Bugsnag.notify).toHaveBeenCalledTimes(1);
    const {error, event, metadata} = lastNotifyEvent();
    expect(error.message).toMatch(/incompatible/);
    expect(event.severity).toBe('error');
    expect(event.context).toBe('compatibility:notebook-schema');
    expect(metadata.compatibility).toMatchObject({
      kind: 'notebook-schema',
      severity: 'error',
      appVersion: '1.2.3',
      serverVersion: '9.9.9',
      serverId: 'srv',
      projectId: 'nb-1',
      notebookName: 'Notebook',
      notebookSchemaVersion: '2.0.0',
      appSchemaVersion: '1.0.0',
      tier: 'incompatible',
      relation: 'newer-major',
      reason: 'Newer major',
      source: 'app-ingest',
    });
  });

  it('reports degraded as warning and dedupes repeats', () => {
    const args = {
      compatibility: {
        tier: 'degraded' as const,
        relation: 'newer-minor' as const,
        appSchemaVersion: '1.0.0',
        notebookSchemaVersion: '1.1.0',
        requiresMigration: false,
        reason: 'Newer minor',
      },
      projectId: 'nb-1',
      serverId: 'srv',
      source: 'app-ingest',
    };
    reportNotebookSchemaCompatibility(args);
    reportNotebookSchemaCompatibility(args);
    expect(Bugsnag.notify).toHaveBeenCalledTimes(1);
    expect(lastNotifyEvent().event.severity).toBe('warning');
  });

  it('reports compile failures as incompatible errors', () => {
    reportNotebookCompileFailure({
      uiSpecificationId: 'spec-1',
      schemaVersion: '1.0.0',
      error: new Error('bad expression'),
    });
    const {event, metadata} = lastNotifyEvent();
    expect(event.severity).toBe('error');
    expect(metadata.compatibility).toMatchObject({
      kind: 'notebook-schema',
      tier: 'incompatible',
      source: 'compile',
      reason: 'bad expression',
    });
  });

  it('reports app/server mismatch as warning with both versions, once per pair', () => {
    reportAppServerVersionMismatch({serverId: 'srv', serverVersion: '2.0.0'});
    reportAppServerVersionMismatch({serverId: 'srv', serverVersion: '2.0.0'});
    reportAppServerVersionMismatch({serverId: 'srv', serverVersion: '2.1.0'});
    expect(Bugsnag.notify).toHaveBeenCalledTimes(2);
    const {event, metadata} = lastNotifyEvent();
    expect(event.severity).toBe('warning');
    expect(event.context).toBe('compatibility:app-server');
    expect(metadata.compatibility).toMatchObject({
      kind: 'app-server',
      appVersion: '1.2.3',
      serverVersion: '2.1.0',
      serverId: 'srv',
    });
  });
});
