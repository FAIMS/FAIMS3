// SPDX-License-Identifier: Apache-2.0

/*
 * Timestamped instance-wide usage snapshot for GET /api/admin/stats.
 * Cheap entity counts come from listing helpers. Record, attachment, and byte
 * totals fan out across survey data DBs in BYTE_COUNT_BATCH_SIZE batches using
 * index/recordCount, index/recordRevisions, index/attachmentAttribution, and
 * Couch info(). A failed per-survey query is skipped and the snapshot is marked
 * incomplete rather than 500ing.
 */

import {
  ADMIN_STATS_DEFAULT_PAGE_LIMIT,
  ADMIN_STATS_MAX_PAGE_LIMIT,
  ADMIN_STATS_UNTEAMED_TEAM_ID,
  ATTACHMENT_ATTRIBUTION_INDEX,
  AdminStatsPersonRow,
  AdminStatsTeamRow,
  GetAdminStatsPeopleResponse,
  GetAdminStatsResponse,
  GetAdminStatsTeamsResponse,
  isPeopleUserAccountDisabled,
  ProjectStatus,
  RECORD_REVISIONS_INDEX,
} from '@faims3/data-model';
import {config} from '../buildconfig';
import {getDataDb, getInvitesDB, getTombstoneDB} from '.';
import {getAllTokens} from './longLivedTokens';
import {listAllAssets} from './mapAssets/store';
import {
  BYTE_COUNT_BATCH_SIZE,
  countRecordsInNotebook,
  getAllProjectsListing,
  getByteCount,
} from './notebooks';
import {getAllTeams} from './teams';
import {getTemplates} from './templates';
import {getUsers} from './users';

/** Running per-person totals keyed by record `created_by`. */
type PersonAccumulator = {
  userId: string;
  recordCount: number;
  attachmentCount: number;
};

/** Running per-team totals, including the unteamed sentinel row. */
type TeamAccumulator = {
  teamId: string;
  name: string;
  notebookCount: number;
  recordCount: number;
  attachmentCount: number;
  byteCount: number;
  mapAssetByteCount: number;
};

/**
 * One cached instance-usage snapshot shared by overall / teams / people
 * endpoints so pagination does not re-scan CouchDB.
 */
export type AdminStatsSnapshot = {
  generatedAt: string;
  expiresAt: string;
  generatedAtMs: number;
  expiresAtMs: number;
  overall: Omit<GetAdminStatsResponse, 'generatedAt' | 'expiresAt'>;
  teams: AdminStatsTeamRow[];
  people: AdminStatsPersonRow[];
};

/** Process-local snapshot; TTL comes from `config.adminStatsCacheTtlMs`. */
let cachedSnapshot: AdminStatsSnapshot | null = null;
/** Coalesces concurrent first-load / refresh callers onto one scan. */
let inflight: Promise<AdminStatsSnapshot> | null = null;

/**
 * Drop the in-memory snapshot and any in-flight scan.
 *
 * Tests call this between cases so a previous fixture's counts cannot leak.
 */
export function resetAdminStatsCache(): void {
  cachedSnapshot = null;
  inflight = null;
}

/**
 * Parse a stats-list `limit` query value, clamping to
 * {@link ADMIN_STATS_MAX_PAGE_LIMIT}. Invalid or missing values fall back to
 * {@link ADMIN_STATS_DEFAULT_PAGE_LIMIT}.
 */
function parseLimit(raw: string | undefined): number {
  if (raw === undefined || raw === '') {
    return ADMIN_STATS_DEFAULT_PAGE_LIMIT;
  }
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1) {
    return ADMIN_STATS_DEFAULT_PAGE_LIMIT;
  }
  return Math.min(n, ADMIN_STATS_MAX_PAGE_LIMIT);
}

/**
 * Parse a stats-list `offset` query value. Invalid or missing values become 0.
 */
function parseOffset(raw: string | undefined): number {
  if (raw === undefined || raw === '') {
    return 0;
  }
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0) {
    return 0;
  }
  return n;
}

/**
 * Count non-design documents in a metadata DB (`allDocs` includes `_design/*`).
 */
async function countNonDesignDocs(
  allDocs: () => Promise<{rows: Array<{id: string}>}>
): Promise<number> {
  const result = await allDocs();
  return result.rows.filter(row => !row.id.startsWith('_')).length;
}

/** View value from `index/recordRevisions` (no document body). */
type RecordRevisionValue = {
  created_by?: unknown;
};

/** View value from `index/attachmentAttribution` (no document body). */
type AttachmentAttributionValue = {
  record_id?: unknown;
  created_by?: unknown;
};

/**
 * Scan one survey data DB for record / attachment / byte totals and per-person
 * attribution. Failures set `incomplete` and skip that query rather than
 * throwing, so one broken notebook cannot 500 the whole snapshot.
 *
 * @param projectId - Notebook / survey id whose data DB to scan
 */
async function scanNotebookData(projectId: string): Promise<{
  recordCount: number;
  attachmentCount: number;
  byteCount: number;
  incomplete: boolean;
  people: Map<string, PersonAccumulator>;
}> {
  const people = new Map<string, PersonAccumulator>();
  /** Increment a per-person counter, creating the row on first sight. */
  const bump = (
    userId: string,
    field: 'recordCount' | 'attachmentCount',
    amount = 1
  ) => {
    if (!userId) return;
    const existing = people.get(userId) ?? {
      userId,
      recordCount: 0,
      attachmentCount: 0,
    };
    existing[field] += amount;
    people.set(userId, existing);
  };

  let recordCount = 0;
  let attachmentCount = 0;
  let byteCount = 0;
  let incomplete = false;

  try {
    recordCount = await countRecordsInNotebook(projectId);
  } catch (error) {
    console.error(`admin stats: record count failed for ${projectId}`, error);
    incomplete = true;
    recordCount = 0;
  }

  try {
    const size = await getByteCount(projectId);
    // getByteCount returns -1 when CouchDB `info()` is unavailable (e.g. Pouch).
    if (size < 0) {
      incomplete = true;
      byteCount = 0;
    } else {
      byteCount = size;
    }
  } catch (error) {
    console.error(`admin stats: byte count failed for ${projectId}`, error);
    incomplete = true;
    byteCount = 0;
  }

  try {
    const dataDb = await getDataDb(projectId);
    const [recordRows, attachmentRows] = await Promise.all([
      dataDb.query(RECORD_REVISIONS_INDEX),
      dataDb.query(ATTACHMENT_ATTRIBUTION_INDEX, {reduce: false}),
    ]);
    const createdByByRecordId = new Map<string, string>();

    for (const row of recordRows.rows) {
      const createdBy = (row.value as RecordRevisionValue | undefined)
        ?.created_by;
      if (typeof createdBy === 'string' && createdBy) {
        createdByByRecordId.set(row.id, createdBy);
        bump(createdBy, 'recordCount');
      }
    }

    attachmentCount = attachmentRows.rows.length;
    for (const row of attachmentRows.rows) {
      const value = row.value as AttachmentAttributionValue | undefined;
      const recordId =
        typeof value?.record_id === 'string' ? value.record_id : undefined;
      const ownCreatedBy =
        typeof value?.created_by === 'string' ? value.created_by : undefined;
      // Prefer the parent record's created_by; fall back to the attachment's own.
      const parentCreatedBy =
        (recordId && createdByByRecordId.get(recordId)) || ownCreatedBy;
      if (parentCreatedBy) {
        bump(parentCreatedBy, 'attachmentCount');
      }
    }
  } catch (error) {
    console.error(`admin stats: data-DB scan failed for ${projectId}`, error);
    incomplete = true;
    attachmentCount = 0;
    // Record counts from index/recordCount still stand; people rows would be partial.
    people.clear();
  }

  return {recordCount, attachmentCount, byteCount, incomplete, people};
}

/**
 * Build a fresh snapshot: cheap listing counts in parallel, then batched
 * per-notebook scans. Listing failures log and contribute 0 rather than 500.
 */
async function computeSnapshot(): Promise<AdminStatsSnapshot> {
  const generatedAtMs = Date.now();
  const ttlMs = Math.max(1, config.adminStatsCacheTtlMs);
  const expiresAtMs = generatedAtMs + ttlMs;
  const generatedAt = new Date(generatedAtMs).toISOString();
  const expiresAt = new Date(expiresAtMs).toISOString();

  const [
    teams,
    users,
    projects,
    templates,
    mapAssets,
    tokens,
    inviteCount,
    tombstoneCount,
  ] = await Promise.all([
    getAllTeams().catch(error => {
      console.error('admin stats: teams listing failed', error);
      return [];
    }),
    getUsers().catch(error => {
      console.error('admin stats: users listing failed', error);
      return [];
    }),
    getAllProjectsListing().catch(error => {
      console.error('admin stats: notebooks listing failed', error);
      return [];
    }),
    getTemplates({}).catch(error => {
      console.error('admin stats: templates listing failed', error);
      return [];
    }),
    listAllAssets().catch(error => {
      console.error('admin stats: map assets listing failed', error);
      return [];
    }),
    getAllTokens().catch(error => {
      console.error('admin stats: long-lived tokens listing failed', error);
      return [];
    }),
    countNonDesignDocs(() => getInvitesDB().allDocs()).catch(error => {
      console.error('admin stats: invites listing failed', error);
      return 0;
    }),
    countNonDesignDocs(() => getTombstoneDB().allDocs()).catch(error => {
      console.error('admin stats: tombstones listing failed', error);
      return 0;
    }),
  ]);

  const teamNameById = new Map(teams.map(team => [team._id, team.name]));
  const emailByUserId = new Map<string, string>();
  const nameByUserId = new Map<string, string>();
  for (const user of users) {
    const email = user.emails?.[0]?.email;
    if (email) emailByUserId.set(user._id, email);
    if (user.name) nameByUserId.set(user._id, user.name);
  }

  const teamAcc = new Map<string, TeamAccumulator>();
  /** Insert a zeroed team row so empty teams still appear in the table. */
  const ensureTeam = (teamId: string, name: string): TeamAccumulator => {
    const existing = teamAcc.get(teamId);
    if (existing) return existing;
    const created: TeamAccumulator = {
      teamId,
      name,
      notebookCount: 0,
      recordCount: 0,
      attachmentCount: 0,
      byteCount: 0,
      mapAssetByteCount: 0,
    };
    teamAcc.set(teamId, created);
    return created;
  };

  for (const team of teams) {
    ensureTeam(team._id, team.name);
  }

  const peopleAcc = new Map<string, PersonAccumulator>();
  const incompleteNotebookIds: string[] = [];
  let recordCount = 0;
  let attachmentCount = 0;
  let byteCount = 0;

  // Same Couch connection cap as directory listings: BYTE_COUNT_BATCH_SIZE.
  for (let i = 0; i < projects.length; i += BYTE_COUNT_BATCH_SIZE) {
    const batch = projects.slice(i, i + BYTE_COUNT_BATCH_SIZE);
    const scanned = await Promise.all(
      batch.map(async project => {
        const stats = await scanNotebookData(project._id);
        return {project, stats};
      })
    );

    for (const {project, stats} of scanned) {
      if (stats.incomplete) {
        incompleteNotebookIds.push(project._id);
      }
      recordCount += stats.recordCount;
      attachmentCount += stats.attachmentCount;
      byteCount += stats.byteCount;

      // Notebooks with no team still need a row; `__unteamed__` sorts last.
      const teamId = project.ownedByTeamId
        ? project.ownedByTeamId
        : ADMIN_STATS_UNTEAMED_TEAM_ID;
      const teamName = project.ownedByTeamId
        ? (teamNameById.get(project.ownedByTeamId) ?? project.ownedByTeamId)
        : 'Unteamed';
      const team = ensureTeam(teamId, teamName);
      team.notebookCount += 1;
      team.recordCount += stats.recordCount;
      team.attachmentCount += stats.attachmentCount;
      team.byteCount += stats.byteCount;

      for (const person of stats.people.values()) {
        const existing = peopleAcc.get(person.userId) ?? {
          userId: person.userId,
          recordCount: 0,
          attachmentCount: 0,
        };
        existing.recordCount += person.recordCount;
        existing.attachmentCount += person.attachmentCount;
        peopleAcc.set(person.userId, existing);
      }
    }
  }

  let mapAssetByteCount = 0;
  for (const asset of mapAssets) {
    const size = asset.byteSize ?? 0;
    mapAssetByteCount += size;
    const teamId = asset.ownedByTeamId
      ? asset.ownedByTeamId
      : ADMIN_STATS_UNTEAMED_TEAM_ID;
    const teamName = asset.ownedByTeamId
      ? (teamNameById.get(asset.ownedByTeamId) ?? asset.ownedByTeamId)
      : 'Unteamed';
    ensureTeam(teamId, teamName).mapAssetByteCount += size;
  }

  const overall: AdminStatsSnapshot['overall'] = {
    teamCount: teams.length,
    userCount: users.length,
    notebookCount: projects.length,
    archivedNotebookCount: projects.filter(
      project => project.status === ProjectStatus.ARCHIVED
    ).length,
    templateCount: templates.length,
    archivedTemplateCount: templates.filter(template => template.archived)
      .length,
    mapAssetCount: mapAssets.length,
    mapAssetByteCount,
    recordCount,
    attachmentCount,
    byteCount,
    disabledUserCount: users.filter(user => isPeopleUserAccountDisabled(user))
      .length,
    inviteCount,
    longLivedTokenCount: tokens.length,
    tombstoneCount,
    incomplete: incompleteNotebookIds.length > 0,
    ...(incompleteNotebookIds.length > 0 ? {incompleteNotebookIds} : {}),
  };

  // Name order, with the unteamed sentinel always last.
  const teamRows: AdminStatsTeamRow[] = [...teamAcc.values()].sort((a, b) => {
    if (a.teamId === ADMIN_STATS_UNTEAMED_TEAM_ID) return 1;
    if (b.teamId === ADMIN_STATS_UNTEAMED_TEAM_ID) return -1;
    return a.name.localeCompare(b.name) || a.teamId.localeCompare(b.teamId);
  });

  // Users with neither records nor attachments are omitted from the people list.
  const peopleRows: AdminStatsPersonRow[] = [...peopleAcc.values()]
    .filter(person => person.recordCount > 0 || person.attachmentCount > 0)
    .map(person => {
      const row: AdminStatsPersonRow = {
        userId: person.userId,
        recordCount: person.recordCount,
        attachmentCount: person.attachmentCount,
      };
      // Email/name are optional: deleted users still appear by userId.
      const email = emailByUserId.get(person.userId);
      if (email) {
        row.email = email;
      }
      const name = nameByUserId.get(person.userId);
      if (name) {
        row.name = name;
      }
      return row;
    })
    .sort((a, b) => {
      // Email then userId; missing emails sort first (empty string).
      const emailA = a.email ?? '';
      const emailB = b.email ?? '';
      return emailA.localeCompare(emailB) || a.userId.localeCompare(b.userId);
    });

  return {
    generatedAt,
    expiresAt,
    generatedAtMs,
    expiresAtMs,
    overall,
    teams: teamRows,
    people: peopleRows,
  };
}

/**
 * Return the cached snapshot, or compute a new one.
 *
 * Concurrent callers — including `refresh: true` — share one in-flight scan so
 * overall / teams / people (or a POST /refresh plus GETs) cannot start three
 * full instance walks at once. `refresh: true` still bypasses TTL when no scan
 * is running. The `inflight === pending` guard stops an older scan's `finally`
 * from clearing a newer refresh's promise.
 *
 * @param refresh - When true, ignore TTL and recompute immediately
 */
export async function getAdminStatsSnapshot({
  refresh = false,
}: {
  refresh?: boolean;
} = {}): Promise<AdminStatsSnapshot> {
  const now = Date.now();
  if (!refresh && cachedSnapshot && now < cachedSnapshot.expiresAtMs) {
    return cachedSnapshot;
  }

  if (inflight) {
    return inflight;
  }

  const pending = computeSnapshot();
  inflight = pending;
  try {
    const snapshot = await pending;
    cachedSnapshot = snapshot;
    return snapshot;
  } finally {
    // A later refresh may have replaced `inflight`; only clear our own scan.
    if (inflight === pending) {
      inflight = null;
    }
  }
}

/**
 * Map a snapshot to the overall GET /api/admin/stats payload.
 */
export function snapshotToOverall(
  snapshot: AdminStatsSnapshot
): GetAdminStatsResponse {
  return {
    generatedAt: snapshot.generatedAt,
    expiresAt: snapshot.expiresAt,
    ...snapshot.overall,
  };
}

/**
 * Slice the snapshot's team rows for GET /api/admin/stats/teams.
 */
export function snapshotToTeamsPage({
  snapshot,
  limit: rawLimit,
  offset: rawOffset,
}: {
  snapshot: AdminStatsSnapshot;
  limit?: string;
  offset?: string;
}): GetAdminStatsTeamsResponse {
  const limit = parseLimit(rawLimit);
  const offset = parseOffset(rawOffset);
  return {
    generatedAt: snapshot.generatedAt,
    expiresAt: snapshot.expiresAt,
    teams: snapshot.teams.slice(offset, offset + limit),
    total: snapshot.teams.length,
    limit,
    offset,
    incomplete: snapshot.overall.incomplete,
  };
}

/**
 * Slice the snapshot's people rows for GET /api/admin/stats/people.
 */
export function snapshotToPeoplePage({
  snapshot,
  limit: rawLimit,
  offset: rawOffset,
}: {
  snapshot: AdminStatsSnapshot;
  limit?: string;
  offset?: string;
}): GetAdminStatsPeopleResponse {
  const limit = parseLimit(rawLimit);
  const offset = parseOffset(rawOffset);
  return {
    generatedAt: snapshot.generatedAt,
    expiresAt: snapshot.expiresAt,
    people: snapshot.people.slice(offset, offset + limit),
    total: snapshot.people.length,
    limit,
    offset,
    incomplete: snapshot.overall.incomplete,
  };
}
