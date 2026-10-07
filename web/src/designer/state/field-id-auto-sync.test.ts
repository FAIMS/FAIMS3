// SPDX-License-Identifier: Apache-2.0

/**
 * @file Rules for Label → Field ID auto-sync (THE TRAP).
 */

import {describe, expect, it} from 'vitest';
import {shouldEnableFieldIdAutoSync} from './field-id-auto-sync';

const NEW_FIELD_ID = 'field-added-this-session';
const EXISTING_FIELD_ID = 'field-loaded-with-notebook';

describe('shouldEnableFieldIdAutoSync', () => {
  it('never enables when the survey already has records', () => {
    expect(
      shouldEnableFieldIdAutoSync({
        existingRecordCount: 3,
        designerIdentifier: NEW_FIELD_ID,
        originalFieldIdentifiers: new Set([EXISTING_FIELD_ID]),
        alreadyConsumed: false,
      })
    ).toBe(false);
  });

  it('never enables an existing field just because its id is New-Field', () => {
    expect(
      shouldEnableFieldIdAutoSync({
        existingRecordCount: 0,
        designerIdentifier: EXISTING_FIELD_ID,
        originalFieldIdentifiers: new Set([EXISTING_FIELD_ID]),
        alreadyConsumed: false,
      })
    ).toBe(false);
  });

  it('enables first-commit of a field added in this session', () => {
    expect(
      shouldEnableFieldIdAutoSync({
        existingRecordCount: 0,
        designerIdentifier: NEW_FIELD_ID,
        originalFieldIdentifiers: new Set([EXISTING_FIELD_ID]),
        alreadyConsumed: false,
      })
    ).toBe(true);
  });

  it('never re-arms after the first commit was consumed', () => {
    expect(
      shouldEnableFieldIdAutoSync({
        existingRecordCount: 0,
        designerIdentifier: NEW_FIELD_ID,
        originalFieldIdentifiers: new Set([EXISTING_FIELD_ID]),
        alreadyConsumed: true,
      })
    ).toBe(false);
  });

  it('treats a survey that started empty as all-new when there are no records', () => {
    expect(
      shouldEnableFieldIdAutoSync({
        existingRecordCount: 0,
        designerIdentifier: NEW_FIELD_ID,
        originalFieldIdentifiers: new Set(),
        alreadyConsumed: false,
      })
    ).toBe(true);
  });

  it('does not guess from Field ID when the session snapshot is unknown', () => {
    expect(
      shouldEnableFieldIdAutoSync({
        existingRecordCount: 0,
        designerIdentifier: NEW_FIELD_ID,
        alreadyConsumed: false,
      })
    ).toBe(false);
  });
});
