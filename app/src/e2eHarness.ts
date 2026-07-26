/**
 * Dev/e2e-only browser harness for probing local Pouch + public (proxy) Couch.
 *
 * Enabled when Vite `DEV` is true or `VITE_E2E_HARNESS=true`. Specs reach this
 * via `window.__FAIMS_E2E__` after login + notebook activation.
 */
import {selectActiveUser} from './context/slices/authSlice';
import {selectAllProjects} from './context/slices/projectSlice';
import {store} from './context/store';
import {localGetDataDb} from './utils/database';

export type FaimsE2eHarness = {
  /** Project id from `/surveys/<server>/<projectId>/…` when on a notebook route. */
  getActiveProjectId(): string | undefined;
  listLocalDocIds(projectId: string): Promise<string[]>;
  localHasDoc(projectId: string, docId: string): Promise<boolean>;
  /**
   * Find `rec-*` ids whose AVP `data` string includes `needle` (e.g. e2e notes).
   */
  findRecordIdsByAvpText(projectId: string, needle: string): Promise<string[]>;
  /**
   * GET a doc via the project's remote `couchUrl` (public/proxy) with the
   * active JWT. Returns false on 403/404, true on 2xx, null on other errors.
   */
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
    __FAIMS_E2E__?: FaimsE2eHarness;
  }
}

function remoteBase(projectId: string): {
  url: string;
  token: string;
} | null {
  const state = store.getState();
  const user = selectActiveUser(state);
  const project = selectAllProjects(state).find(p => p.projectId === projectId);
  const conn = project?.database?.remote?.connectionConfiguration;
  if (!user?.token || !conn?.couchUrl || !conn.databaseName) {
    return null;
  }
  const couchUrl = conn.couchUrl.endsWith('/')
    ? conn.couchUrl
    : `${conn.couchUrl}/`;
  return {
    url: `${couchUrl}${conn.databaseName}`,
    token: user.token,
  };
}

export function installE2eHarness(): void {
  const enabled =
    import.meta.env.DEV === true || import.meta.env.VITE_E2E_HARNESS === 'true';
  if (!enabled) {
    return;
  }

  const harness: FaimsE2eHarness = {
    getActiveProjectId() {
      const match = window.location.pathname.match(/\/surveys\/[^/]+\/([^/]+)/);
      return match?.[1];
    },

    async listLocalDocIds(projectId: string) {
      const db = localGetDataDb(projectId);
      const res = await db.allDocs();
      return res.rows.map(row => row.id);
    },

    async localHasDoc(projectId: string, docId: string) {
      try {
        await localGetDataDb(projectId).get(docId);
        return true;
      } catch {
        return false;
      }
    },

    async findRecordIdsByAvpText(projectId: string, needle: string) {
      const db = localGetDataDb(projectId);
      const res = await db.allDocs({include_docs: true});
      const ids = new Set<string>();
      for (const row of res.rows) {
        const doc = row.doc as {data?: unknown; record_id?: string} | undefined;
        if (
          doc &&
          typeof doc.data === 'string' &&
          doc.data.includes(needle) &&
          typeof doc.record_id === 'string' &&
          doc.record_id.startsWith('rec-')
        ) {
          ids.add(doc.record_id);
        }
      }
      return [...ids];
    },

    async remoteHasDoc(projectId: string, docId: string) {
      const remote = remoteBase(projectId);
      if (!remote) {
        return null;
      }
      try {
        const res = await fetch(`${remote.url}/${encodeURIComponent(docId)}`, {
          headers: {Authorization: `Bearer ${remote.token}`},
        });
        if (res.status === 404 || res.status === 403) {
          return false;
        }
        if (!res.ok) {
          return null;
        }
        return true;
      } catch {
        return null;
      }
    },

    async waitForLocalDoc(projectId, docId, timeoutMs = 45000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (await this.localHasDoc(projectId, docId)) {
          return true;
        }
        await new Promise(r => setTimeout(r, 500));
      }
      return false;
    },

    async waitForRemoteDoc(projectId, docId, timeoutMs = 45000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const present = await this.remoteHasDoc(projectId, docId);
        if (present === true) {
          return true;
        }
        await new Promise(r => setTimeout(r, 500));
      }
      return false;
    },
  };

  window.__FAIMS_E2E__ = harness;
}
