// SPDX-License-Identifier: Apache-2.0

/*
 * Timestamped instance-wide usage snapshot for GET /api/admin/stats.
 * Cheap entity counts come from listing helpers / allDocs. Record, attachment,
 * and byte totals fan out across survey data DBs in BYTE_COUNT_BATCH_SIZE
 * batches. A failed per-survey query is skipped and the snapshot is marked
 * incomplete rather than 500ing.
 */

import {
  ADMIN_STATS_DEFAULT_PAGE_LIMIT,
  ADMIN_STATS_MAX_PAGE_LIMIT,
  ADMIN_STATS_UNTEAMED_TEAM_ID,
  AdminStatsPersonRow,
  AdminStatsTeamRow,
  GetAdminStatsPeopleResponse,
  GetAdminStatsResponse,
  GetAdminStatsTeamsResponse,
  isPeopleUserAccountDisabled,
  ProjectStatus,
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

type PersonAccumulator = {
  userId: string;
  recordCount: number;
  attachmentCount: number;
};

type TeamAccumulator = {
  teamId: string;
  name: string;
  notebookCount: number;
  recordCount: number;
  attachmentCount: number;
  byteCount: number;
};

export type AdminStatsSnapshot = {
  generatedAt: string;
  expiresAt: string;
  generatedAtMs: number;
  expiresAtMs: number;
  overall: Omit<GetAdminStatsResponse, 'generatedAt' | 'expiresAt'>;
  teams: AdminStatsTeamRow[];
  people: AdminStatsPersonRow[];
};

let cachedSnapshot: AdminStatsSnapshot | null = null;
let inflight: Promise<AdminStatsSnapshot> | null = null;

/** Drop the in-memory snapshot (tests). */
export function resetAdminStatsCache(): void {
  cachedSnapshot = null;
  inflight = null;
}

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

async function countNonDesignDocs(
  allDocs: () => Promise<{rows: Array<{id: string}>}>
): Promise<number> {
  const result = await allDocs();
  return result.rows.filter(row => !row.id.startsWith('_')).length;
}

function isRecordDoc(doc: unknown): doc is {
  _id: string;
  record_format_version: number;
  created_by?: string;
} {
  return (
    !!doc &&
    typeof doc === 'object' &&
    (doc as {record_format_version?: unknown}).record_format_version === 1
  );
}

function isAttachmentDoc(doc: unknown): doc is {
  _id: string;
  attach_format_version: number;
  record_id?: string;
  created_by?: string;
} {
  return (
    !!doc &&
    typeof doc === 'object' &&
    (doc as {attach_format_version?: unknown}).attach_format_version === 1
  );
}

async function scanNotebookData(projectId: string): Promise<{
  recordCount: number;
  attachmentCount: number;
  byteCount: number;
  incomplete: boolean;
  people: Map<string, PersonAccumulator>;
}> {
  const people = new Map<string, PersonAccumulator>();
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
    const allDocs = await dataDb.allDocs({include_docs: true});
    const createdByByRecordId = new Map<string, string>();

    for (const row of allDocs.rows) {
      const doc = row.doc;
      if (isRecordDoc(doc) && typeof doc.created_by === 'string') {
        createdByByRecordId.set(doc._id, doc.created_by);
        bump(doc.created_by, 'recordCount');
      }
    }

    for (const row of allDocs.rows) {
      const doc = row.doc;
      if (!isAttachmentDoc(doc)) continue;
      attachmentCount += 1;
      const parentCreatedBy =
        (doc.record_id && createdByByRecordId.get(doc.record_id)) ||
        (typeof doc.created_by === 'string' ? doc.created_by : undefined);
      if (parentCreatedBy) {
        bump(parentCreatedBy, 'attachmentCount');
      }
    }
  } catch (error) {
    console.error(`admin stats: data-DB scan failed for ${projectId}`, error);
    incomplete = true;
    attachmentCount = 0;
    people.clear();
  }

  return {recordCount, attachmentCount, byteCount, incomplete, people};
}

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

  const teamRows: AdminStatsTeamRow[] = [...teamAcc.values()].sort((a, b) => {
    if (a.teamId === ADMIN_STATS_UNTEAMED_TEAM_ID) return 1;
    if (b.teamId === ADMIN_STATS_UNTEAMED_TEAM_ID) return -1;
    return a.name.localeCompare(b.name) || a.teamId.localeCompare(b.teamId);
  });

  const peopleRows: AdminStatsPersonRow[] = [...peopleAcc.values()]
    .filter(person => person.recordCount > 0 || person.attachmentCount > 0)
    .map(person => {
      const row: AdminStatsPersonRow = {
        userId: person.userId,
        recordCount: person.recordCount,
        attachmentCount: person.attachmentCount,
      };
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

export async function getAdminStatsSnapshot({
  refresh = false,
}: {
  refresh?: boolean;
} = {}): Promise<AdminStatsSnapshot> {
  const now = Date.now();
  if (!refresh && cachedSnapshot && now < cachedSnapshot.expiresAtMs) {
    return cachedSnapshot;
  }

  if (!refresh && inflight) {
    return inflight;
  }

  const pending = computeSnapshot();
  inflight = pending;
  try {
    const snapshot = await pending;
    cachedSnapshot = snapshot;
    return snapshot;
  } finally {
    if (inflight === pending) {
      inflight = null;
    }
  }
}

export function snapshotToOverall(
  snapshot: AdminStatsSnapshot
): GetAdminStatsResponse {
  return {
    generatedAt: snapshot.generatedAt,
    expiresAt: snapshot.expiresAt,
    ...snapshot.overall,
  };
}

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
