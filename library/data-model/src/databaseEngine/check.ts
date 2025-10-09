#!/usr/bin/env tsx
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
 * Filename: scripts/validate-database.ts
 * Description:
 *   Validates all documents in CouchDB databases against FAIMS data models
 */

import PouchDB from 'pouchdb';
import * as fs from 'fs';
import {ZodError} from 'zod';
import {
  getDocumentType,
  recordDocumentSchema,
  revisionDocumentSchema,
  avpDocumentSchema,
  attachmentDocumentSchema,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

interface Config {
  url: string;
  username: string;
  password: string;
}

function getConfig(): Config {
  const args = process.argv.slice(2);

  if (args.length !== 3) {
    console.error(
      'Usage: tsx validate-database.ts <url> <username> <password>'
    );
    console.error(
      'Example: tsx validate-database.ts http://localhost:5984 admin password'
    );
    console.error('');
    console.error('This will validate all databases starting with "data-"');
    process.exit(1);
  }

  return {
    url: args[0],
    username: args[1],
    password: args[2],
  };
}

// ============================================================================
// Statistics Tracking
// ============================================================================

interface ValidationError {
  docId: string;
  docType: string;
  error: string;
  document: any;
}

interface Statistics {
  totalDocuments: number;
  recordDocuments: number;
  revisionDocuments: number;
  avpDocuments: number;
  attachmentDocuments: number;
  unknownDocuments: number;
  validDocuments: number;
  invalidDocuments: number;
  validationErrors: ValidationError[];
}

interface DatabaseStatistics {
  [dbName: string]: Statistics;
}

function createStatistics(): Statistics {
  return {
    totalDocuments: 0,
    recordDocuments: 0,
    revisionDocuments: 0,
    avpDocuments: 0,
    attachmentDocuments: 0,
    unknownDocuments: 0,
    validDocuments: 0,
    invalidDocuments: 0,
    validationErrors: [],
  };
}

// ============================================================================
// Document Validation
// ============================================================================

function validateDocument(doc: any, stats: Statistics): void {
  const docType = getDocumentType(doc);

  // Skip design documents
  if (doc._id.startsWith('_design/')) {
    return;
  }

  stats.totalDocuments++;

  try {
    switch (docType) {
      case 'record':
        recordDocumentSchema.parse(doc);
        stats.recordDocuments++;
        stats.validDocuments++;
        break;

      case 'revision':
        revisionDocumentSchema.parse(doc);
        stats.revisionDocuments++;
        stats.validDocuments++;
        break;

      case 'avp':
        avpDocumentSchema.parse(doc);
        stats.avpDocuments++;
        stats.validDocuments++;
        break;

      case 'attachment':
        attachmentDocumentSchema.parse(doc);
        stats.attachmentDocuments++;
        stats.validDocuments++;
        break;

      case 'unknown':
        stats.unknownDocuments++;
        stats.invalidDocuments++;
        stats.validationErrors.push({
          docId: doc._id,
          docType: 'unknown',
          error:
            'Document does not match any known type (no format_version field found)',
          document: doc,
        });
        break;
    }
  } catch (error) {
    stats.invalidDocuments++;

    let errorMessage = 'Unknown error';
    if (error instanceof ZodError) {
      errorMessage = JSON.stringify(error.errors, null, 2);
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    stats.validationErrors.push({
      docId: doc._id,
      docType,
      error: errorMessage,
      document: doc,
    });
  }
}

// ============================================================================
// Report Generation
// ============================================================================

function generateDatabaseReport(dbName: string, stats: Statistics): string {
  const lines: string[] = [];

  lines.push(
    '================================================================================'
  );
  lines.push(`DATABASE: ${dbName}`);
  lines.push(
    '================================================================================'
  );
  lines.push('');

  lines.push('SUMMARY STATISTICS');
  lines.push(
    '--------------------------------------------------------------------------------'
  );
  lines.push(`Total Documents:       ${stats.totalDocuments}`);
  lines.push(
    `Valid Documents:       ${stats.validDocuments} (${((stats.validDocuments / stats.totalDocuments) * 100).toFixed(2)}%)`
  );
  lines.push(
    `Invalid Documents:     ${stats.invalidDocuments} (${((stats.invalidDocuments / stats.totalDocuments) * 100).toFixed(2)}%)`
  );
  lines.push('');

  lines.push('DOCUMENT TYPE BREAKDOWN');
  lines.push(
    '--------------------------------------------------------------------------------'
  );
  lines.push(`Record Documents:      ${stats.recordDocuments}`);
  lines.push(`Revision Documents:    ${stats.revisionDocuments}`);
  lines.push(`AVP Documents:         ${stats.avpDocuments}`);
  lines.push(`Attachment Documents:  ${stats.attachmentDocuments}`);
  lines.push(`Unknown Documents:     ${stats.unknownDocuments}`);
  lines.push('');

  if (stats.validationErrors.length > 0) {
    lines.push('VALIDATION ERRORS');
    lines.push(
      '--------------------------------------------------------------------------------'
    );
    lines.push(`Total Errors: ${stats.validationErrors.length}`);
    lines.push('');

    stats.validationErrors.forEach((error, index) => {
      lines.push(`Error #${index + 1}`);
      lines.push(
        '- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -'
      );
      lines.push(`Document ID:   ${error.docId}`);
      lines.push(`Document Type: ${error.docType}`);
      lines.push('');
      lines.push('Error Details:');
      lines.push(error.error);
      lines.push('');
      lines.push('Document Content:');
      lines.push(JSON.stringify(error.document, null, 2));
      lines.push('');
    });
  } else {
    lines.push('NO VALIDATION ERRORS FOUND');
    lines.push(
      '--------------------------------------------------------------------------------'
    );
    lines.push('All documents successfully validated against their schemas!');
    lines.push('');
  }

  return lines.join('\n');
}

function generateSummaryReport(dbStats: DatabaseStatistics): string {
  const lines: string[] = [];

  lines.push(
    '================================================================================'
  );
  lines.push('FAIMS DATABASE VALIDATION REPORT - SUMMARY');
  lines.push(
    '================================================================================'
  );
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  const dbNames = Object.keys(dbStats).sort();
  let totalDocs = 0;
  let totalValid = 0;
  let totalInvalid = 0;
  let totalErrors = 0;

  lines.push('DATABASE OVERVIEW');
  lines.push(
    '================================================================================'
  );
  lines.push('');

  dbNames.forEach(dbName => {
    const stats = dbStats[dbName];
    totalDocs += stats.totalDocuments;
    totalValid += stats.validDocuments;
    totalInvalid += stats.invalidDocuments;
    totalErrors += stats.validationErrors.length;

    const statusIcon = stats.validationErrors.length === 0 ? '✅' : '❌';
    lines.push(`${statusIcon} ${dbName}`);
    lines.push(
      `   Documents: ${stats.totalDocuments} | Valid: ${stats.validDocuments} | Invalid: ${stats.invalidDocuments} | Errors: ${stats.validationErrors.length}`
    );
    lines.push('');
  });

  lines.push('OVERALL STATISTICS');
  lines.push(
    '================================================================================'
  );
  lines.push(`Total Databases:       ${dbNames.length}`);
  lines.push(`Total Documents:       ${totalDocs}`);
  lines.push(
    `Valid Documents:       ${totalValid} (${((totalValid / totalDocs) * 100).toFixed(2)}%)`
  );
  lines.push(
    `Invalid Documents:     ${totalInvalid} (${((totalInvalid / totalDocs) * 100).toFixed(2)}%)`
  );
  lines.push(`Total Errors:          ${totalErrors}`);
  lines.push('');

  return lines.join('\n');
}

function generateFullReport(dbStats: DatabaseStatistics): string {
  const lines: string[] = [];

  lines.push(
    '================================================================================'
  );
  lines.push('FAIMS DATABASE VALIDATION REPORT - FULL REPORT');
  lines.push(
    '================================================================================'
  );
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('');

  // Add summary
  lines.push(generateSummaryReport(dbStats));
  lines.push('');
  lines.push('');

  // Add individual database reports
  const dbNames = Object.keys(dbStats).sort();
  dbNames.forEach((dbName, index) => {
    lines.push(generateDatabaseReport(dbName, dbStats[dbName]));
    if (index < dbNames.length - 1) {
      lines.push('');
      lines.push('');
    }
  });

  return lines.join('\n');
}

// ============================================================================
// Database Discovery and Validation
// ============================================================================

async function getDataDatabases(
  baseUrl: string,
  auth: {username: string; password: string}
): Promise<string[]> {
  try {
    // Connect to _all_dbs endpoint
    const response = await fetch(`${baseUrl}/_all_dbs`, {
      headers: {
        Authorization:
          'Basic ' +
          Buffer.from(`${auth.username}:${auth.password}`).toString('base64'),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch database list: ${response.statusText}`);
    }

    const allDbs: string[] = await response.json();

    // Filter databases that start with 'data-'
    return allDbs.filter(db => db.startsWith('data-'));
  } catch (error) {
    console.error('Error fetching database list:', error);
    throw error;
  }
}

async function validateDatabase(
  url: string,
  dbName: string,
  auth: {username: string; password: string}
): Promise<Statistics> {
  const stats = createStatistics();

  console.log(`  Connecting to ${dbName}...`);

  const db = new PouchDB(`${url}/${dbName}`, {
    auth: {
      username: auth.username,
      password: auth.password,
    },
  });

  try {
    console.log(`  Fetching documents from ${dbName}...`);

    const result = await db.allDocs({
      include_docs: true,
      attachments: false,
    });

    console.log(`  Found ${result.rows.length} documents in ${dbName}`);
    console.log(`  Validating documents...`);

    for (const row of result.rows) {
      if (row.doc) {
        validateDocument(row.doc, stats);
      }
    }

    console.log(
      `  ✓ Completed ${dbName}: ${stats.validDocuments}/${stats.totalDocuments} valid`
    );
  } catch (error) {
    console.error(`  ✗ Error validating ${dbName}:`, error);
    throw error;
  }

  return stats;
}

// ============================================================================
// Main Function
// ============================================================================

async function main() {
  const config = getConfig();

  console.log(
    '================================================================================'
  );
  console.log('FAIMS Database Validation');
  console.log(
    '================================================================================'
  );
  console.log(`CouchDB URL: ${config.url}`);
  console.log(`Username: ${config.username}`);
  console.log('');

  console.log('Step 1: Discovering databases...');
  const dataDatabases = await getDataDatabases(config.url, {
    username: config.username,
    password: config.password,
  });

  if (dataDatabases.length === 0) {
    console.log('No databases starting with "data-" found.');
    process.exit(0);
  }

  console.log(`Found ${dataDatabases.length} databases starting with "data-":`);
  dataDatabases.forEach(db => console.log(`  - ${db}`));
  console.log('');

  console.log('Step 2: Validating databases...');
  console.log('');

  const dbStats: DatabaseStatistics = {};

  for (const dbName of dataDatabases) {
    try {
      dbStats[dbName] = await validateDatabase(config.url, dbName, {
        username: config.username,
        password: config.password,
      });
    } catch (error) {
      console.error(`Failed to validate ${dbName}, skipping...`);
    }
  }

  console.log('');
  console.log('Step 3: Generating reports...');

  const summaryReport = generateSummaryReport(dbStats);
  const fullReport = generateFullReport(dbStats);

  // Write reports
  fs.writeFileSync('report-summary.log', summaryReport);
  fs.writeFileSync('report-full.log', fullReport);

  console.log('');
  console.log(
    '================================================================================'
  );
  console.log('Validation Complete!');
  console.log(
    '================================================================================'
  );
  console.log(`Reports written to:`);
  console.log(`  - report-summary.log (overview)`);
  console.log(`  - report-full.log (detailed)`);
  console.log('');

  // Print summary to console
  console.log(summaryReport);

  // Exit with error code if any validation errors found
  const totalErrors = Object.values(dbStats).reduce(
    (sum, stats) => sum + stats.validationErrors.length,
    0
  );

  if (totalErrors > 0) {
    console.log('');
    console.log(
      '⚠️  Validation errors found. Check report-full.log for details.'
    );
    process.exit(1);
  } else {
    console.log('');
    console.log(
      '✅ All documents validated successfully across all databases!'
    );
    process.exit(0);
  }
}

// Run the script
main();
