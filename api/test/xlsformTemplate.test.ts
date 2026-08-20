/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: xlsformTemplate.test.ts
 * Description:
 *   Integration tests for POST /api/templates/from-xlsform -- the
 *   server-side XLSForm-to-Fieldmark template creation endpoint.
 */

import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory'));
PouchDB.plugin(PouchDBFind);

import {beforeEach, describe, expect, it} from 'vitest';
import request from 'supertest';
import {app} from '../src/expressSetup';
import {
  adminToken,
  beforeApiTests,
  localUserToken,
  requestAuthAndType,
} from './utils';
import {createSampleTeam} from './teams.test';

const TEMPLATE_API_BASE = '/api/templates';

/**
 * Builds a minimal, valid XLSForm workbook in memory (matching the shape
 * confirmed working against the real read-excel-file parsing pipeline:
 * a `survey` sheet with a text/select_one/integer question each, a
 * `choices` sheet backing the select_one, and a `settings` sheet).
 *
 * Returns the workbook as a base64-encoded string, ready to send as
 * `fileBase64` in the request body.
 */
const buildSampleXlsformBase64 = (): string => {
  // Lazily require xlsx-writing support only inside the test file, so the
  // main src code has no test-only dependency. Uses a plain CSV-per-sheet
  // -> xlsx approach via a minimal in-memory workbook builder.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const XLSX = require('xlsx');

  const surveySheet = XLSX.utils.aoa_to_sheet([
    ['type', 'name', 'label', 'hint', 'required'],
    ['text', 'q1', 'What is your name?', 'Enter your full name', 'yes'],
    ['select_one yn', 'q2', 'Do you consent to this survey?', '', 'yes'],
    ['integer', 'q3', 'What is your age?', '', 'no'],
  ]);
  const choicesSheet = XLSX.utils.aoa_to_sheet([
    ['list_name', 'name', 'label'],
    ['yn', 'yes', 'Yes'],
    ['yn', 'no', 'No'],
  ]);
  const settingsSheet = XLSX.utils.aoa_to_sheet([
    ['form_title', 'form_id'],
    ['Integration Test Form', 'integration_test'],
  ]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, surveySheet, 'survey');
  XLSX.utils.book_append_sheet(workbook, choicesSheet, 'choices');
  XLSX.utils.book_append_sheet(workbook, settingsSheet, 'settings');

  const buffer: Buffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  });
  return buffer.toString('base64');
};

/** Same builder, but the survey sheet is missing entirely -- used to test
 * the "missing required sheet" error path. */
const buildXlsformMissingSurveySheetBase64 = (): string => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const XLSX = require('xlsx');
  const choicesSheet = XLSX.utils.aoa_to_sheet([
    ['list_name', 'name', 'label'],
    ['yn', 'yes', 'Yes'],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, choicesSheet, 'choices');
  const buffer: Buffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  });
  return buffer.toString('base64');
};

/** Same builder, but one survey row is missing its required `name` column
 * value -- used to test the sheet/row/column-level error reporting. */
const buildXlsformMissingRequiredColumnBase64 = (): string => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const XLSX = require('xlsx');
  const surveySheet = XLSX.utils.aoa_to_sheet([
    ['type', 'name', 'label'],
    ['text', '', 'A question with no name'],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, surveySheet, 'survey');
  const buffer: Buffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  });
  return buffer.toString('base64');
};

/** A syntactically invalid "file" -- not a real xlsx at all. */
const buildGarbageBase64 = (): string =>
  Buffer.from('this is not a spreadsheet').toString('base64');

describe('POST /api/templates/from-xlsform', () => {
  beforeEach(beforeApiTests);

  it('creates a template from a valid XLSForm, converting all supported field types', async () => {
    const fileBase64 = buildSampleXlsformBase64();
    const team = await createSampleTeam(app, {teamName: 'XLSForm Team'});

    const res = await requestAuthAndType(
      request(app)
        .post(`${TEMPLATE_API_BASE}/from-xlsform`)
        .send({
          name: 'XLSForm Integration Test',
          teamId: team._id,
          fileBase64,
        })
    ).expect(200);

    expect(res.body.name).toBe('XLSForm Integration Test');
    expect(res.body.ownedByTeamId).toBe(team._id);
    expect(res.body.skipped).toEqual([]);

    const fields = res.body.uiSpecification.uiSpec.fields;
    expect(fields.q1['component-name']).toBe('TextField');
    expect(fields.q1['type-returned']).toBe('faims-core::String');

    expect(fields.q2['component-name']).toBe('RadioGroup');
    expect(fields.q2['component-parameters'].ElementProps.options).toEqual([
      {label: 'Yes', value: 'yes'},
      {label: 'No', value: 'no'},
    ]);

    expect(fields.q3['component-name']).toBe('NumberField');
    expect(fields.q3['component-parameters'].numberType).toBe('integer');

    expect(res.body.uiSpecification.uiSpec.viewsets.Main.hridField).toBe(
      'q1'
    );
    expect(res.body.uiSpecification.uiSpec.viewsets.Main.label).toBe(
      'Integration Test Form'
    );
  });

  it('creates a global (non-team) template when no teamId is supplied', async () => {
    const fileBase64 = buildSampleXlsformBase64();

    const res = await requestAuthAndType(
      request(app).post(`${TEMPLATE_API_BASE}/from-xlsform`).send({
        name: 'Global XLSForm Template',
        fileBase64,
      })
    ).expect(200);

    expect(res.body.ownedByTeamId).toBeUndefined();
  });

  it('rejects a request with no fileBase64', async () => {
    await requestAuthAndType(
      request(app).post(`${TEMPLATE_API_BASE}/from-xlsform`).send({
        name: 'Missing File',
      })
    ).expect(400);
  });

  it('rejects a name shorter than 5 characters', async () => {
    const fileBase64 = buildSampleXlsformBase64();
    await requestAuthAndType(
      request(app).post(`${TEMPLATE_API_BASE}/from-xlsform`).send({
        name: 'abc',
        fileBase64,
      })
    ).expect(400);
  });

  it('rejects a file that is not a valid xlsx workbook', async () => {
    const fileBase64 = buildGarbageBase64();
    await requestAuthAndType(
      request(app).post(`${TEMPLATE_API_BASE}/from-xlsform`).send({
        name: 'Garbage File Test',
        fileBase64,
      })
    ).expect(400);
  });

  it('rejects a workbook missing the required survey sheet', async () => {
    const fileBase64 = buildXlsformMissingSurveySheetBase64();
    const res = await requestAuthAndType(
      request(app).post(`${TEMPLATE_API_BASE}/from-xlsform`).send({
        name: 'Missing Survey Sheet',
        fileBase64,
      })
    ).expect(400);

    expect(res.body.error?.message ?? res.body.message).toMatch(/survey/i);
  });

  it('rejects a survey row missing a required column, naming the row', async () => {
    const fileBase64 = buildXlsformMissingRequiredColumnBase64();
    const res = await requestAuthAndType(
      request(app).post(`${TEMPLATE_API_BASE}/from-xlsform`).send({
        name: 'Missing Required Column',
        fileBase64,
      })
    ).expect(400);

    const message: string = res.body.error?.message ?? res.body.message ?? '';
    expect(message).toMatch(/row/i);
    expect(message).toMatch(/name/i);
  });

  it('rejects creating a template in a team the user has no access to', async () => {
    const fileBase64 = buildSampleXlsformBase64();
    const team = await createSampleTeam(app, {teamName: 'Inaccessible Team'});

    // localUserToken belongs to a user with no roles at all -- should not
    // be able to create a template in any team.
    await requestAuthAndType(
      request(app)
        .post(`${TEMPLATE_API_BASE}/from-xlsform`)
        .send({
          name: 'Unauthorized Team Template',
          teamId: team._id,
          fileBase64,
        }),
      localUserToken
    ).expect(401);
  });

  it('rejects creating a public template without CREATE_PUBLIC_TEMPLATE permission', async () => {
    const fileBase64 = buildSampleXlsformBase64();
    const team = await createSampleTeam(app, {teamName: 'Public Test Team'});

    await requestAuthAndType(
      request(app)
        .post(`${TEMPLATE_API_BASE}/from-xlsform`)
        .send({
          name: 'Unauthorized Public Template',
          teamId: team._id,
          isPublic: true,
          fileBase64,
        }),
      localUserToken
    ).expect(401);
  });

  it('records unsupported XLSForm question types in skipped rather than failing the import', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require('xlsx');
    const surveySheet = XLSX.utils.aoa_to_sheet([
      ['type', 'name', 'label'],
      ['text', 'q1', 'A supported question'],
      ['rank', 'q2', 'An unsupported question'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, surveySheet, 'survey');
    const buffer: Buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });
    const fileBase64 = buffer.toString('base64');

    const res = await requestAuthAndType(
      request(app).post(`${TEMPLATE_API_BASE}/from-xlsform`).send({
        name: 'Partial Support Test',
        fileBase64,
      })
    ).expect(200);

    expect(res.body.uiSpecification.uiSpec.fields.q1).toBeTruthy();
    expect(res.body.uiSpecification.uiSpec.fields.q2).toBeUndefined();
    expect(res.body.skipped).toEqual([{name: 'q2', type: 'rank'}]);
  });

  it('requires authentication', async () => {
    const fileBase64 = buildSampleXlsformBase64();
    await request(app)
      .post(`${TEMPLATE_API_BASE}/from-xlsform`)
      .set('Content-Type', 'application/json')
      .send({name: 'No Auth Test', fileBase64})
      .expect(401);
  });
});
