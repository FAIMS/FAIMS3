// SPDX-License-Identifier: Apache-2.0
/**
 * Pure helpers for the record History tab: classify revisions, group them by
 * local calendar day, and resolve display labels / field-type icons from the
 * notebook UI spec.
 */
import {
  getFieldLabel,
  getFormLabel,
  RecursiveRecordHistory,
  RevisionHistoryEntry,
  UiSpecModel,
} from '@faims3/data-model';

export type HistoryEventKind = 'created' | 'updated' | 'deleted';

export type FlattenedHistoryEvent = {
  created: string;
  entry: RevisionHistoryEntry;
  recordId: string;
  formId: string;
  hrid: string;
};

export type HistoryDateGroup<T = RevisionHistoryEntry> = {
  key: string;
  label: string;
  entries: T[];
};

const HISTORY_LOCALE = 'en-AU';

/** Local Y-M-D key so grouping follows the viewer's calendar, not UTC. */
export function toLocalDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return toLocalDateKey(a) === toLocalDateKey(b);
}

export function getHistoryEventKind(
  entry: RevisionHistoryEntry
): HistoryEventKind {
  if (entry.deleted) {
    return 'deleted';
  }
  const parentIds = Object.keys(entry.changedFields);
  if (parentIds.length === 1 && parentIds[0] === 'root') {
    return 'created';
  }
  return 'updated';
}

export function getChangedFieldIds(entry: RevisionHistoryEntry): string[] {
  return [...new Set(Object.values(entry.changedFields).flat())];
}

export function getHistoryEventActor(entry: RevisionHistoryEntry): string {
  return entry.createdBy.trim() || 'Someone';
}

export function getHistoryEventAction(
  kind: HistoryEventKind
): 'Created' | 'Updated' | 'Deleted' {
  if (kind === 'created') {
    return 'Created';
  }
  if (kind === 'deleted') {
    return 'Deleted';
  }
  return 'Updated';
}

export function getHistoryEventTitle(
  entry: RevisionHistoryEntry,
  kind: HistoryEventKind = getHistoryEventKind(entry)
): string {
  return `${getHistoryEventActor(entry)} ${getHistoryEventAction(kind)}`;
}

/**
 * Prefer the section that contains the most changed fields; fall back to the
 * form label (and for create/delete, always use the form — every field is new).
 */
export function getHistoryEventSubtitle({
  entry,
  uiSpec,
  formId,
  kind = getHistoryEventKind(entry),
  isChild = false,
}: {
  entry: RevisionHistoryEntry;
  uiSpec: UiSpecModel;
  formId?: string;
  kind?: HistoryEventKind;
  isChild?: boolean;
}): string {
  const formLabel = formId
    ? getFormLabel({uiSpec, formId})
    : (Object.values(uiSpec.viewsets)[0]?.label ?? 'Record');

  if (isChild || kind === 'created' || kind === 'deleted') {
    return formLabel;
  }

  const fieldIds = new Set(getChangedFieldIds(entry));
  if (fieldIds.size === 0) {
    return formLabel;
  }

  const sectionScores: Array<{label: string; count: number}> = [];
  for (const [viewId, view] of Object.entries(uiSpec.views ?? {})) {
    const count = (view.fields ?? []).filter(fieldId =>
      fieldIds.has(fieldId)
    ).length;
    if (count > 0) {
      sectionScores.push({label: view.label ?? viewId, count});
    }
  }

  if (sectionScores.length === 0) {
    return formLabel;
  }

  const topCount = Math.max(...sectionScores.map(section => section.count));
  const leaders = sectionScores.filter(section => section.count === topCount);
  if (leaders.length === 1 && leaders[0]) {
    return leaders[0].label;
  }

  return formLabel;
}

export function formatHistoryEventDate(
  date: Date,
  locale: string = HISTORY_LOCALE
): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = new Intl.DateTimeFormat(locale, {month: 'long'}).format(date);
  return `${day} ${month}`;
}

export function formatHistoryEventTime(
  date: Date,
  locale: string = HISTORY_LOCALE
): string {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(date)
    .toLowerCase()
    .replace(/\u202f/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatHistoryGroupLabel(
  date: Date,
  now: Date = new Date(),
  locale: string = HISTORY_LOCALE
): string {
  const day = date.getDate();
  const month = new Intl.DateTimeFormat(locale, {month: 'long'})
    .format(date)
    .toUpperCase();
  const dated = `${day} ${month}`;

  if (isSameLocalDay(date, now)) {
    return `TODAY, ${dated}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameLocalDay(date, yesterday)) {
    return `YESTERDAY, ${dated}`;
  }

  if (date.getFullYear() === now.getFullYear()) {
    return dated;
  }

  return `${dated} ${date.getFullYear()}`;
}

export function flattenRecordHistory(
  tree: RecursiveRecordHistory
): FlattenedHistoryEvent[] {
  const events: FlattenedHistoryEvent[] = [];

  const walk = (node: RecursiveRecordHistory) => {
    for (const entry of node.entries) {
      events.push({
        created: entry.created,
        entry,
        recordId: node.recordId,
        formId: node.formId,
        hrid: node.hrid,
      });
    }
    for (const field of node.childFields) {
      for (const child of field.children) {
        walk(child);
      }
    }
  };

  walk(tree);
  return events;
}

export function groupHistoryByDate<T extends {created: string}>(
  entries: T[],
  now: Date = new Date()
): HistoryDateGroup<T>[] {
  const sorted = entries
    .slice()
    .sort((a, b) => b.created.localeCompare(a.created));

  const groups: HistoryDateGroup<T>[] = [];
  const indexByKey = new Map<string, HistoryDateGroup<T>>();

  for (const entry of sorted) {
    const date = new Date(entry.created);
    const key = toLocalDateKey(date);
    let group = indexByKey.get(key);
    if (!group) {
      group = {
        key,
        label: formatHistoryGroupLabel(date, now),
        entries: [],
      };
      indexByKey.set(key, group);
      groups.push(group);
    }
    group.entries.push(entry);
  }

  return groups;
}

export function getFieldLabels(
  fieldIds: string[],
  uiSpec: UiSpecModel
): string[] {
  return fieldIds.map(fieldId => getFieldLabel(uiSpec, fieldId));
}
