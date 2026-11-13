// SPDX-License-Identifier: Apache-2.0

import {UI_SPECIFICATION_HASH_HEX_LENGTH} from '@faims3/data-model';
import {ConflictException, InvalidRequestException} from '../exceptions';

const HASH_PATTERN = new RegExp(
  `^[a-fA-F0-9]{${UI_SPECIFICATION_HASH_HEX_LENGTH}}$`
);

/**
 * Parse `If-Match` as a uiSpecification SHA-256 hex digest. Empty means the
 * client is not making a conditional write (JSON upload / confirmed overwrite).
 */
export function parseIfMatchUiSpecHash(
  header: string | undefined
): string | undefined {
  if (header === undefined) {
    return undefined;
  }
  const trimmed = header.trim();
  if (trimmed === '') {
    return undefined;
  }
  const unquoted =
    trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2
      ? trimmed.slice(1, -1)
      : trimmed;
  if (!HASH_PATTERN.test(unquoted)) {
    throw new InvalidRequestException(
      'If-Match must be the 64-character uiSpecification hash.'
    );
  }
  return unquoted.toLowerCase();
}

/**
 * When If-Match is present, the live `uiSpecProperties.hash` must match.
 * Omitted If-Match keeps the previous last-write-wins PUT.
 */
export function assertUiSpecIfMatch(
  currentHash: string,
  ifMatchHeader: string | undefined
): void {
  const expected = parseIfMatchUiSpecHash(ifMatchHeader);
  if (expected === undefined) {
    return;
  }
  if (expected !== currentHash.toLowerCase()) {
    throw new ConflictException(
      'The live design has changed since this draft was opened. Reload the live design or confirm overwrite.'
    );
  }
}
