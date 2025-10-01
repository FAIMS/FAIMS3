/**
 * Load Testing Script for PouchDB Attachment Storage
 *
 * This script populates a PouchDB database with test image attachments to simulate
 * large-scale data exports. It repeatedly uploads a specified JPEG file from the local filesystem.
 *
 * Usage:
 *   ts-node loadTestAttachments.ts --file /path/to/image.jpg --count 100 --project my-project-id
 *
 * Options:
 *   --file: Path to JPEG file to upload (required)
 *   --count: Number of attachments to create (default: 50)
 *   --project: Project ID to use (default: from environment)
 *   --concurrent: Number of concurrent uploads (default: 5)
 */

import {ProjectDataObject, ProjectID} from '@faims3/data-model';
import * as fs from 'fs';
import * as path from 'path';
import {v4 as uuidv4} from 'uuid';
import {getDataDb} from '../couchdb';

// Configuration
interface LoadTestConfig {
  count: number;
  projectId: ProjectID;
  filePath: string;
  concurrentUploads: number;
}

/**
 * Reads a file from the local filesystem
 */
function readLocalFile(filePath: string): Buffer {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const stats = fs.statSync(filePath);
  if (!stats.isFile()) {
    throw new Error(`Not a file: ${filePath}`);
  }

  return fs.readFileSync(filePath);
}

/**
 * Creates a single attachment record with the image data
 */
async function createAttachmentRecord(
  db: PouchDB.Database,
  imageBuffer: Buffer,
  filename: string,
  index: number
): Promise<void> {
  const attachmentId = `att-${uuidv4()}`;
  const recordId = `rec-${uuidv4()}`;
  const revisionId = `frev-${uuidv4()}`;
  const avpId = `avp-${uuidv4()}`;

  const now = new Date().toISOString();

  // Create the document structure matching your format
  const doc = {
    _id: attachmentId,
    attach_format_version: 1,
    avp_id: avpId,
    revision_id: revisionId,
    record_id: recordId,
    created: now,
    created_by: 'load-test-script',
    filename: `${filename}-copy-${index}`,
    _attachments: {
      [attachmentId]: {
        content_type: 'image/jpeg',
        data: imageBuffer,
      },
    },
  };

  await db.put(doc);
}

/**
 * Processes a batch of uploads concurrently
 */
async function processBatch(
  db: PouchDB.Database,
  imageBuffer: Buffer,
  filename: string,
  config: LoadTestConfig,
  startIndex: number,
  batchSize: number
): Promise<void> {
  const promises: Promise<void>[] = [];

  for (let i = 0; i < batchSize; i++) {
    const index = startIndex + i;

    const promise = (async () => {
      try {
        console.log(
          `[${index + 1}/${config.count}] Uploading ${(imageBuffer.length / 1024).toFixed(2)}KB to database...`
        );
        await createAttachmentRecord(db, imageBuffer, filename, index);

        console.log(`[${index + 1}/${config.count}] ✓ Successfully uploaded`);
      } catch (error) {
        console.error(`[${index + 1}/${config.count}] ✗ Failed:`, error);
        throw error;
      }
    })();

    promises.push(promise);
  }

  await Promise.all(promises);
}

/**
 * Main load testing function
 */
async function runLoadTest(config: LoadTestConfig): Promise<void> {
  console.log('='.repeat(60));
  console.log('PouchDB Attachment Load Test');
  console.log('='.repeat(60));
  console.log(`Project ID: ${config.projectId}`);
  console.log(`Source file: ${config.filePath}`);
  console.log(`Target count: ${config.count} attachments`);
  console.log(`Concurrent uploads: ${config.concurrentUploads}`);
  console.log('='.repeat(60));
  console.log('');

  const startTime = Date.now();

  // Read the local file
  console.log('Reading local file...');
  const imageBuffer = readLocalFile(config.filePath);
  const fileSizeMB = (imageBuffer.length / 1024 / 1024).toFixed(2);
  const filename = path.basename(config.filePath, path.extname(config.filePath));
  console.log(`✓ File loaded: ${fileSizeMB}MB\n`);

  // Initialize database
  console.log('Connecting to database...');
  const db = (await getDataDb(
    config.projectId
  )) as PouchDB.Database<ProjectDataObject>;
  console.log('✓ Database connected\n');

  // Get initial database size
  const initialInfo = await db.info();
  console.log(`Initial document count: ${initialInfo.doc_count}\n`);

  // Process uploads in batches
  let totalUploaded = 0;
  let totalFailed = 0;

  for (let i = 0; i < config.count; i += config.concurrentUploads) {
    const batchSize = Math.min(config.concurrentUploads, config.count - i);

    console.log(
      `\nProcessing batch ${Math.floor(i / config.concurrentUploads) + 1}...`
    );

    try {
      await processBatch(db, imageBuffer, filename, config, i, batchSize);
      totalUploaded += batchSize;
    } catch (error) {
      totalFailed += batchSize;
      console.error('Batch failed, continuing...');
    }

    // Show progress
    const progress = (((i + batchSize) / config.count) * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `Progress: ${progress}% (${totalUploaded} uploaded, ${totalFailed} failed) - ${elapsed}s elapsed`
    );
  }

  // Get final database size
  const finalInfo = await db.info();
  const docIncrease = finalInfo.doc_count - initialInfo.doc_count;

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalDataMB = (totalUploaded * imageBuffer.length / 1024 / 1024).toFixed(2);

  console.log('\n' + '='.repeat(60));
  console.log('Load Test Complete');
  console.log('='.repeat(60));
  console.log(`Total time: ${totalTime}s`);
  console.log(`Successfully uploaded: ${totalUploaded}/${config.count}`);
  console.log(`Failed: ${totalFailed}/${config.count}`);
  console.log(`Documents added: ${docIncrease}`);
  console.log(`Total data uploaded: ${totalDataMB}MB`);
  console.log(
    `Average upload rate: ${(totalUploaded / parseFloat(totalTime)).toFixed(2)} attachments/second`
  );
  console.log('='.repeat(60));
}

/**
 * Parse command line arguments
 */
function parseArgs(): LoadTestConfig {
  const args = process.argv.slice(2);

  const config: LoadTestConfig = {
    count: 50,
    projectId: process.env.PROJECT_ID || 'default-project',
    filePath: '',
    concurrentUploads: 5,
  };

  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--file':
        config.filePath = value;
        break;
      case '--count':
        config.count = parseInt(value, 10);
        break;
      case '--project':
        config.projectId = value as ProjectID;
        break;
      case '--concurrent':
        config.concurrentUploads = parseInt(value, 10);
        break;
      default:
        console.error(`Unknown flag: ${flag}`);
        process.exit(1);
    }
  }

  // Validate required arguments
  if (!config.filePath) {
    console.error('Error: --file argument is required');
    console.log('\nUsage:');
    console.log('  ts-node loadTestAttachments.ts --file /path/to/image.jpg [options]');
    console.log('\nOptions:');
    console.log('  --file <path>        Path to JPEG file (required)');
    console.log('  --count <number>     Number of uploads (default: 50)');
    console.log('  --project <id>       Project ID (default: from env)');
    console.log('  --concurrent <num>   Concurrent uploads (default: 5)');
    process.exit(1);
  }

  return config;
}

// Run the load test
if (require.main === module) {
  const config = parseArgs();

  runLoadTest(config)
    .then(() => {
      console.log('\n✓ Load test completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n✗ Load test failed:', error);
      process.exit(1);
    });
}
