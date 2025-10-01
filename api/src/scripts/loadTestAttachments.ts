/**
 * Load Testing Script for PouchDB Attachment Storage
 *
 * This script populates a PouchDB database with test image attachments to simulate
 * large-scale data exports. It downloads sample images from online sources and creates
 * attachment records in the format expected by your application.
 *
 * Usage:
 *   ts-node loadTestAttachments.ts --count 100 --project my-project-id
 *
 * Options:
 *   --count: Number of attachments to create (default: 50)
 *   --project: Project ID to use (default: from environment)
 *   --size: Image size - 'small' (100KB), 'medium' (500KB), 'large' (2MB), 'mixed' (default: mixed)
 *   --concurrent: Number of concurrent uploads (default: 5)
 */

import {ProjectDataObject, ProjectID} from '@faims3/data-model';
import * as http from 'http';
import * as https from 'https';
import {v4 as uuidv4} from 'uuid';
import {getDataDb} from '../couchdb';

// Configuration
interface LoadTestConfig {
  count: number;
  projectId: ProjectID;
  imageSize: 'small' | 'medium' | 'large' | 'mixed';
  concurrentUploads: number;
}

interface TestImageSource {
  url: string;
  size: 'small' | 'medium' | 'large';
  contentType: string;
}

// Image sources - using picsum.photos for random test images
// These are different sizes to simulate realistic data
const IMAGE_SOURCES: TestImageSource[] = [
  // Small images (~100-200KB)
  {
    url: 'https://picsum.photos/400/300',
    size: 'small',
    contentType: 'image/jpeg',
  },
  {
    url: 'https://picsum.photos/300/400',
    size: 'small',
    contentType: 'image/jpeg',
  },
  {
    url: 'https://picsum.photos/350/350',
    size: 'small',
    contentType: 'image/jpeg',
  },

  // Medium images (~500KB-1MB)
  {
    url: 'https://picsum.photos/800/600',
    size: 'medium',
    contentType: 'image/jpeg',
  },
  {
    url: 'https://picsum.photos/600/800',
    size: 'medium',
    contentType: 'image/jpeg',
  },
  {
    url: 'https://picsum.photos/700/700',
    size: 'medium',
    contentType: 'image/jpeg',
  },

  // Large images (~2-3MB)
  {
    url: 'https://picsum.photos/1920/1080',
    size: 'large',
    contentType: 'image/jpeg',
  },
  {
    url: 'https://picsum.photos/1080/1920',
    size: 'large',
    contentType: 'image/jpeg',
  },
  {
    url: 'https://picsum.photos/1600/1200',
    size: 'large',
    contentType: 'image/jpeg',
  },
];

/**
 * Downloads an image from a URL and returns it as a Buffer
 */
async function downloadImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol
      .get(url, response => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            downloadImage(redirectUrl).then(resolve).catch(reject);
            return; // Add explicit return here
          }
          // Handle missing location header
          reject(new Error('Redirect without location header'));
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: ${response.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        response.on('end', () => {
          resolve(Buffer.concat(chunks as any));
        });
        response.on('error', reject);
      })
      .on('error', reject);
  });
}

/**
 * Selects an appropriate image source based on size preference
 */
function selectImageSource(
  sizePreference: 'small' | 'medium' | 'large' | 'mixed'
): TestImageSource {
  if (sizePreference === 'mixed') {
    // Randomly select from all sizes
    return IMAGE_SOURCES[Math.floor(Math.random() * IMAGE_SOURCES.length)];
  }

  const filtered = IMAGE_SOURCES.filter(
    source => source.size === sizePreference
  );
  return filtered[Math.floor(Math.random() * filtered.length)];
}

/**
 * Creates a single attachment record with the downloaded image
 */
async function createAttachmentRecord(
  db: PouchDB.Database,
  imageBuffer: Buffer,
  contentType: string,
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
    filename: `load-test-image-${index}`,
    _attachments: {
      [attachmentId]: {
        content_type: contentType,
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
  config: LoadTestConfig,
  startIndex: number,
  batchSize: number
): Promise<void> {
  const promises: Promise<void>[] = [];

  for (let i = 0; i < batchSize; i++) {
    const index = startIndex + i;
    const imageSource = selectImageSource(config.imageSize);

    const promise = (async () => {
      try {
        console.log(
          `[${index + 1}/${config.count}] Downloading image from ${imageSource.url}...`
        );
        const imageBuffer = await downloadImage(imageSource.url);

        console.log(
          `[${index + 1}/${config.count}] Uploading ${(imageBuffer.length / 1024).toFixed(2)}KB to database...`
        );
        await createAttachmentRecord(
          db,
          imageBuffer,
          imageSource.contentType,
          index
        );

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
  console.log(`Target count: ${config.count} attachments`);
  console.log(`Image size: ${config.imageSize}`);
  console.log(`Concurrent uploads: ${config.concurrentUploads}`);
  console.log('='.repeat(60));
  console.log('');

  const startTime = Date.now();

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
      await processBatch(db, config, i, batchSize);
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

  console.log('\n' + '='.repeat(60));
  console.log('Load Test Complete');
  console.log('='.repeat(60));
  console.log(`Total time: ${totalTime}s`);
  console.log(`Successfully uploaded: ${totalUploaded}/${config.count}`);
  console.log(`Failed: ${totalFailed}/${config.count}`);
  console.log(`Documents added: ${docIncrease}`);
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
    imageSize: 'mixed',
    concurrentUploads: 5,
  };

  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--count':
        config.count = parseInt(value, 10);
        break;
      case '--project':
        config.projectId = value as ProjectID;
        break;
      case '--size':
        if (['small', 'medium', 'large', 'mixed'].includes(value)) {
          config.imageSize = value as any;
        }
        break;
      case '--concurrent':
        config.concurrentUploads = parseInt(value, 10);
        break;
      default:
        console.error(`Unknown flag: ${flag}`);
        process.exit(1);
    }
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
