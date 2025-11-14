/* eslint-disable n/no-process-exit */

/**
 * A helper script which pulls and validates all records in a FAIMS deployment.
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
  isRecordDocument,
  hydratedRecordSchema,
  DataDocument,
} from './types';
import {DataEngine} from './engine';

// ============================================================================
// Configuration
// ============================================================================

interface Config {
  url: string;
  username: string;
  password: string;
  testHydration: boolean;
}

function getConfig(): Config {
  const args = process.argv.slice(2);

  // Check for --test-hydration flag
  const testHydrationIndex = args.indexOf('--test-hydration');
  const testHydration = testHydrationIndex !== -1;

  // Remove the flag from args if present
  if (testHydrationIndex !== -1) {
    args.splice(testHydrationIndex, 1);
  }

  if (args.length !== 3) {
    console.error(
      'Usage: tsx check.ts <url> <username> <password> [--test-hydration]'
    );
    console.error('Example: tsx check.ts http://localhost:5984 admin password');
    console.error(
      'Example: tsx check.ts http://localhost:5984 admin password --test-hydration'
    );
    console.error('');
    console.error('This will validate all databases starting with "data-"');
    console.error('');
    console.error('Options:');
    console.error(
      '  --test-hydration    Test hydration of all record documents'
    );
    process.exit(1);
  }

  return {
    url: args[0],
    username: args[1],
    password: args[2],
    testHydration,
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

interface HydrationError {
  recordId: string;
  error: string;
  details?: any;
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
  // Hydration-specific stats
  hydrationTested: boolean;
  recordsHydrated: number;
  recordsHydrationFailed: number;
  recordsWithConflicts: number;
  recordsWithMissingData: number;
  recordsWithInvalidData: number;
  hydrationErrors: HydrationError[];
}

interface DatabaseStatistics {
  [dbName: string]: Statistics;
}

function createStatistics(testHydration: boolean): Statistics {
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
    hydrationTested: testHydration,
    recordsHydrated: 0,
    recordsHydrationFailed: 0,
    recordsWithConflicts: 0,
    recordsWithMissingData: 0,
    recordsWithInvalidData: 0,
    hydrationErrors: [],
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
// Hydration Testing
// ============================================================================

async function testHydration(
  engine: DataEngine,
  recordId: string,
  stats: Statistics
): Promise<void> {
  try {
    // Attempt to hydrate the record with pickFirst behavior to handle conflicts
    const hydratedRecord = await engine.hydrated.getHydratedRecord({recordId});

    stats.recordsHydrated++;

    // Track if there were conflicts
    if (hydratedRecord.metadata.hadConflict) {
      stats.recordsWithConflicts++;
    }

    // Validate the hydrated record structure
    try {
      hydratedRecordSchema.parse(hydratedRecord);
    } catch (error) {
      stats.recordsWithInvalidData++;
      stats.hydrationErrors.push({
        recordId,
        error: 'Hydrated record failed schema validation',
        details: error instanceof ZodError ? error.errors : error,
      });
      return;
    }

    // Check if data field is complete - all AVPs from revision should be present
    const expectedFields = Object.keys(hydratedRecord.revision.avps);
    const actualFields = Object.keys(hydratedRecord.data);

    const missingFields = expectedFields.filter(
      field => !actualFields.includes(field)
    );

    if (missingFields.length > 0) {
      stats.recordsWithMissingData++;
      stats.hydrationErrors.push({
        recordId,
        error: `Hydrated record missing ${missingFields.length} field(s)`,
        details: {
          missingFields,
          expectedFieldCount: expectedFields.length,
          actualFieldCount: actualFields.length,
        },
      });
      return;
    }

    // Validate that all AVPs have required fields
    for (const [fieldName, avp] of Object.entries(hydratedRecord.data)) {
      if (!avp._id || !avp._rev || avp.data === undefined) {
        stats.recordsWithInvalidData++;
        stats.hydrationErrors.push({
          recordId,
          error: `Field "${fieldName}" has incomplete AVP data`,
          details: {
            fieldName,
            avpId: avp._id,
            hasRev: !!avp._rev,
            hasData: avp.data !== undefined,
          },
        });
        return;
      }
    }

    // All checks passed - hydration successful
  } catch (error) {
    stats.recordsHydrationFailed++;

    let errorMessage = 'Unknown hydration error';
    let errorDetails: any = undefined;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = {
        name: error.name,
        stack: error.stack,
      };
    }

    stats.hydrationErrors.push({
      recordId,
      error: errorMessage,
      details: errorDetails,
    });
  }
}

async function testAllRecordsHydration(
  db: PouchDB.Database<DataDocument>,
  records: any[],
  stats: Statistics
): Promise<void> {
  if (!stats.hydrationTested || records.length === 0) {
    return;
  }

  console.log(`  Testing hydration for ${records.length} records...`);

  const engine = new DataEngine({
    dataDb: db,
    // NOTE: placeholder
    uiSpec: {} as any,
  });

  let processed = 0;
  const total = records.length;
  const reportInterval = Math.max(1, Math.floor(total / 10)); // Report every 10%

  for (const record of records) {
    await testHydration(engine, record._id, stats);
    processed++;

    if (processed % reportInterval === 0 || processed === total) {
      const percentage = ((processed / total) * 100).toFixed(1);
      console.log(`    Progress: ${processed}/${total} (${percentage}%)`);
    }
  }

  const successRate = ((stats.recordsHydrated / records.length) * 100).toFixed(
    2
  );
  console.log(
    `  ✓ Hydration complete: ${stats.recordsHydrated}/${records.length} successful (${successRate}%)`
  );

  if (stats.recordsWithConflicts > 0) {
    console.log(`    ⚠️  ${stats.recordsWithConflicts} records had conflicts`);
  }
  if (stats.recordsHydrationFailed > 0) {
    console.log(
      `    ✗ ${stats.recordsHydrationFailed} records failed to hydrate`
    );
  }
  if (stats.recordsWithMissingData > 0) {
    console.log(
      `    ⚠️  ${stats.recordsWithMissingData} records had missing data`
    );
  }
  if (stats.recordsWithInvalidData > 0) {
    console.log(
      `    ⚠️  ${stats.recordsWithInvalidData} records had invalid data`
    );
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

  // Add hydration statistics if tested
  if (stats.hydrationTested && stats.recordDocuments > 0) {
    lines.push('HYDRATION TEST RESULTS');
    lines.push(
      '--------------------------------------------------------------------------------'
    );
    const successRate =
      stats.recordDocuments > 0
        ? ((stats.recordsHydrated / stats.recordDocuments) * 100).toFixed(2)
        : '0.00';
    lines.push(
      `Records Hydrated:      ${stats.recordsHydrated}/${stats.recordDocuments} (${successRate}%)`
    );
    lines.push(`Hydration Failures:    ${stats.recordsHydrationFailed}`);
    lines.push(`Records with Conflicts: ${stats.recordsWithConflicts}`);
    lines.push(`Records with Missing Data: ${stats.recordsWithMissingData}`);
    lines.push(`Records with Invalid Data: ${stats.recordsWithInvalidData}`);
    lines.push('');
  }

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

  if (stats.hydrationTested && stats.hydrationErrors.length > 0) {
    lines.push('HYDRATION ERRORS');
    lines.push(
      '--------------------------------------------------------------------------------'
    );
    lines.push(`Total Hydration Errors: ${stats.hydrationErrors.length}`);
    lines.push('');

    stats.hydrationErrors.forEach((error, index) => {
      lines.push(`Hydration Error #${index + 1}`);
      lines.push(
        '- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -'
      );
      lines.push(`Record ID:     ${error.recordId}`);
      lines.push('');
      lines.push('Error:');
      lines.push(error.error);
      if (error.details) {
        lines.push('');
        lines.push('Details:');
        lines.push(JSON.stringify(error.details, null, 2));
      }
      lines.push('');
    });
  } else if (stats.hydrationTested) {
    lines.push('NO HYDRATION ERRORS FOUND');
    lines.push(
      '--------------------------------------------------------------------------------'
    );
    lines.push('All records successfully hydrated!');
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
  let totalRecords = 0;
  let totalHydrated = 0;
  let totalHydrationErrors = 0;
  let anyHydrationTested = false;

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

    if (stats.hydrationTested) {
      anyHydrationTested = true;
      totalRecords += stats.recordDocuments;
      totalHydrated += stats.recordsHydrated;
      totalHydrationErrors += stats.hydrationErrors.length;
    }

    const statusIcon = stats.validationErrors.length === 0 ? '✅' : '❌';
    const hydrationIcon = stats.hydrationTested
      ? stats.hydrationErrors.length === 0
        ? '✅'
        : '⚠️'
      : '';

    lines.push(`${statusIcon} ${dbName} ${hydrationIcon}`);
    lines.push(
      `   Documents: ${stats.totalDocuments} | Valid: ${stats.validDocuments} | Invalid: ${stats.invalidDocuments} | Errors: ${stats.validationErrors.length}`
    );

    if (stats.hydrationTested) {
      lines.push(
        `   Hydration: ${stats.recordsHydrated}/${stats.recordDocuments} records | Errors: ${stats.hydrationErrors.length} | Conflicts: ${stats.recordsWithConflicts}`
      );
    }

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

  if (anyHydrationTested) {
    lines.push('');
    lines.push('HYDRATION STATISTICS');
    lines.push(
      '================================================================================'
    );
    const hydrationRate =
      totalRecords > 0
        ? ((totalHydrated / totalRecords) * 100).toFixed(2)
        : '0.00';
    lines.push(`Total Records:         ${totalRecords}`);
    lines.push(`Successfully Hydrated: ${totalHydrated} (${hydrationRate}%)`);
    lines.push(`Hydration Errors:      ${totalHydrationErrors}`);
  }

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
  auth: {username: string; password: string},
  testHydration: boolean
): Promise<Statistics> {
  const stats = createStatistics(testHydration);

  console.log(`  Connecting to ${dbName}...`);

  const db = new PouchDB<DataDocument>(`${url}/${dbName}`, {
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
    console.log('  Validating documents...');

    // Collect record documents for hydration testing
    const recordDocs: any[] = [];

    for (const row of result.rows) {
      if (row.doc) {
        validateDocument(row.doc, stats);

        // Collect record documents if we're testing hydration
        if (testHydration && isRecordDocument(row.doc)) {
          recordDocs.push(row.doc);
        }
      }
    }

    console.log(
      `  ✓ Completed validation: ${stats.validDocuments}/${stats.totalDocuments} valid`
    );

    // Test hydration if requested
    if (testHydration) {
      await testAllRecordsHydration(db, recordDocs, stats);
    }
  } catch (error) {
    console.error(`  ✗ Error validating ${dbName}:`, error);
    process.exit(1);
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
  console.log(`Test Hydration: ${config.testHydration ? 'Yes' : 'No'}`);
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
  if (config.testHydration) {
    console.log('         (Including hydration testing)');
  }
  console.log('');

  const dbStats: DatabaseStatistics = {};

  for (const dbName of dataDatabases) {
    try {
      dbStats[dbName] = await validateDatabase(
        config.url,
        dbName,
        {
          username: config.username,
          password: config.password,
        },
        config.testHydration
      );
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
  console.log('Reports written to:');
  console.log('  - report-summary.log (overview)');
  console.log('  - report-full.log (detailed)');
  console.log('');

  // Print summary to console
  console.log(summaryReport);

  // Exit with error code if any validation or hydration errors found
  const totalErrors = Object.values(dbStats).reduce(
    (sum, stats) => sum + stats.validationErrors.length,
    0
  );

  const totalHydrationErrors = Object.values(dbStats).reduce(
    (sum, stats) => sum + stats.hydrationErrors.length,
    0
  );

  if (totalErrors > 0 || totalHydrationErrors > 0) {
    console.log('');
    if (totalErrors > 0) {
      console.log(
        '⚠️  Validation errors found. Check report-full.log for details.'
      );
    }
    if (totalHydrationErrors > 0) {
      console.log(
        '⚠️  Hydration errors found. Check report-full.log for details.'
      );
    }
    process.exit(1);
  } else {
    console.log('');
    console.log(
      '✅ All documents validated successfully across all databases!'
    );
    if (config.testHydration) {
      console.log('✅ All records hydrated successfully!');
    }
    process.exit(0);
  }
}

// Run the script
main();
