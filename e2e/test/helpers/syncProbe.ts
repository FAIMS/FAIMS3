/**
 * Helpers for auth-proxy sync assertions via `window.__FAIMS_E2E__`.
 */
import {browser} from '@wdio/globals';

export type E2eHarnessProbe = {
  getActiveProjectId(): string | undefined;
  listLocalDocIds(projectId: string): Promise<string[]>;
  localHasDoc(projectId: string, docId: string): Promise<boolean>;
  findRecordIdsByAvpText(projectId: string, needle: string): Promise<string[]>;
  remoteHasDoc(projectId: string, docId: string): Promise<boolean | null>;
  waitForLocalDoc(
    projectId: string,
    docId: string,
    timeoutMs?: number
  ): Promise<boolean>;
  waitForRemoteDoc(
    projectId: string,
    docId: string,
    timeoutMs?: number
  ): Promise<boolean>;
};

declare global {
  interface Window {
    __FAIMS_E2E__?: E2eHarnessProbe;
  }
}

async function ensureHarness(): Promise<void> {
  await browser.waitUntil(
    async () =>
      browser.execute(() => typeof window.__FAIMS_E2E__ !== 'undefined'),
    {
      timeout: 15000,
      timeoutMsg:
        'Expected window.__FAIMS_E2E__ (enable DEV or VITE_E2E_HARNESS=true)',
    }
  );
}

/** Resolve project id from the open notebook URL (or harness). */
export async function getActiveProjectId(): Promise<string> {
  const fromUrl = await browser.execute(() => {
    const match = window.location.pathname.match(/\/surveys\/[^/]+\/([^/]+)/);
    return match?.[1] ?? null;
  });
  if (fromUrl) return fromUrl;
  await ensureHarness();
  const id = await browser.execute(
    () => window.__FAIMS_E2E__?.getActiveProjectId() ?? null
  );
  if (!id) {
    throw new Error('Could not resolve active project id from URL/harness');
  }
  return id;
}

export async function findLocalRecordIdsByNotes(
  projectId: string,
  notes: string
): Promise<string[]> {
  await ensureHarness();
  return browser.execute(
    async (pid: string, needle: string) => {
      const h = window.__FAIMS_E2E__;
      if (!h) throw new Error('missing __FAIMS_E2E__');
      return h.findRecordIdsByAvpText(pid, needle);
    },
    projectId,
    notes
  );
}

export async function waitForLocalRecordByNotes(
  projectId: string,
  notes: string,
  timeoutMs = 45000
): Promise<string> {
  let found: string[] = [];
  await browser.waitUntil(
    async () => {
      found = await findLocalRecordIdsByNotes(projectId, notes);
      return found.length > 0;
    },
    {
      timeout: timeoutMs,
      timeoutMsg: `Expected local record with notes "${notes}" in ${projectId}`,
      interval: 500,
    }
  );
  return found[0]!;
}

export async function localHasDoc(
  projectId: string,
  docId: string
): Promise<boolean> {
  await ensureHarness();
  return browser.execute(
    async (pid: string, id: string) => {
      const h = window.__FAIMS_E2E__;
      if (!h) throw new Error('missing __FAIMS_E2E__');
      return h.localHasDoc(pid, id);
    },
    projectId,
    docId
  );
}

export async function remoteHasDoc(
  projectId: string,
  docId: string
): Promise<boolean | null> {
  await ensureHarness();
  return browser.execute(
    async (pid: string, id: string) => {
      const h = window.__FAIMS_E2E__;
      if (!h) throw new Error('missing __FAIMS_E2E__');
      return h.remoteHasDoc(pid, id);
    },
    projectId,
    docId
  );
}

export async function waitForRemoteDoc(
  projectId: string,
  docId: string,
  timeoutMs = 45000
): Promise<void> {
  await browser.waitUntil(
    async () => (await remoteHasDoc(projectId, docId)) === true,
    {
      timeout: timeoutMs,
      timeoutMsg: `Expected remote (proxy) doc ${docId} for ${projectId}`,
      interval: 500,
    }
  );
}

export async function waitForLocalDoc(
  projectId: string,
  docId: string,
  timeoutMs = 45000
): Promise<void> {
  await browser.waitUntil(async () => localHasDoc(projectId, docId), {
    timeout: timeoutMs,
    timeoutMsg: `Expected local doc ${docId} for ${projectId}`,
    interval: 500,
  });
}

/**
 * Assert a doc is still absent from local DB and remote proxy after waiting
 * (negative sync isolation).
 */
export async function assertDocStaysAbsent(
  projectId: string,
  docId: string,
  settleMs = 8000
): Promise<void> {
  const deadline = Date.now() + settleMs;
  while (Date.now() < deadline) {
    if (await localHasDoc(projectId, docId)) {
      throw new Error(
        `Isolation failure: local DB for ${projectId} contains ${docId}`
      );
    }
    const remote = await remoteHasDoc(projectId, docId);
    if (remote === true) {
      throw new Error(
        `Isolation failure: proxy returned ${docId} for ${projectId}`
      );
    }
    await browser.pause(500);
  }
  expect(await localHasDoc(projectId, docId)).toBe(false);
  const finalRemote = await remoteHasDoc(projectId, docId);
  expect(finalRemote === true).toBe(false);
}
