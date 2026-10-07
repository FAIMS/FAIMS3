// SPDX-License-Identifier: Apache-2.0

/**
 * Label → Field ID auto-sync is the first commit of a field added in this
 * designer session, and only while the survey still has no records.
 *
 * Matching `New-Field*` is not a reason to enable or re-arm. An existing field
 * can keep that default id; auto-syncing it after records exist orphans data.
 */
export function shouldEnableFieldIdAutoSync({
  existingRecordCount,
  designerIdentifier,
  originalFieldIdentifiers,
  alreadyConsumed,
}: {
  existingRecordCount?: number;
  designerIdentifier?: string;
  originalFieldIdentifiers?: ReadonlySet<string>;
  alreadyConsumed: boolean;
}): boolean {
  if (alreadyConsumed) return false;
  if ((existingRecordCount ?? 0) > 0) return false;
  if (!designerIdentifier) return false;
  // Unknown session: do not guess from the current Field ID.
  if (!originalFieldIdentifiers) return false;
  // Survey started empty, so every field in this session is new.
  if (originalFieldIdentifiers.size === 0) return true;
  return !originalFieldIdentifiers.has(designerIdentifier);
}
