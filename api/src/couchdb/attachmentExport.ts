import {
  ProjectID,
  notebookRecordIterator,
  HydratedDataRecord,
} from '@faims3/data-model';
import archiver from 'archiver';
import {getNanoDataDb, getDataDb} from '.';
import {DEVELOPER_MODE} from '../buildconfig';
import {getProjectUIModel} from './notebooks';

/**
 * Maximum number of file streams to process concurrently when building the ZIP archive.
 * This limit prevents excessive memory usage while still allowing parallel I/O operations.
 */
const MAX_CONCURRENT_STREAMS = 15;

/**
 * Streams notebook files as a ZIP archive directly to a writable stream.
 *
 * This function creates a ZIP archive containing all non-deleted attachments from a notebook view.
 * It processes records with bounded parallelism to balance performance and memory usage, streaming
 * file buffers directly into the archive without keeping them all in memory simultaneously.
 *
 * @param projectId - The ID of the project containing the notebook
 * @param viewID - The ID of the view to export (currently unused but reserved for future filtering)
 * @param res - The writable stream (typically an HTTP response) to pipe the ZIP data to
 *
 * @throws Error if database access fails or archiving encounters an error
 */
export const streamNotebookFilesAsZip = async (
  projectId: ProjectID,
  viewID: string,
  res: NodeJS.WritableStream
): Promise<void> => {
  // Statistics tracking
  let recordCount = 0;
  let fileCount = 0;

  try {
    logMemory('START');

    // Initialize database connections and iterators
    const nanoDb = await getNanoDataDb(projectId);
    console.log('VIEW ID IS ', viewID);
    const iterator = await createNotebookRecordIterator(
      projectId,
      viewID,
      false
    );

    // Create and configure ZIP archive (without auto-finalize)
    const archive = createConfiguredArchive(res);

    // Track filenames to avoid duplicates
    const filenames: string[] = [];

    // Maintain a pool of concurrent promises for streaming files
    const activeStreams = new Set<Promise<void>>();

    // Process all records with bounded concurrency
    let {record, done} = await iterator.next();

    console.log(
      `Record iterator first entry = record ${JSON.stringify(record)} done ${done}`
    );

    while (!done || activeStreams.size > 0) {
      // Start new streams up to the concurrency limit
      while (!done && activeStreams.size < MAX_CONCURRENT_STREAMS) {
        if (record !== null) {
          const streamPromise = processRecord(
            record,
            nanoDb,
            archive,
            filenames,
            recordCount,
            fileCount
          );

          // Track active streams and clean up on completion
          activeStreams.add(streamPromise);
          streamPromise
            .then(() => {
              fileCount++;
            })
            .catch(err => {
              console.error(
                `[ZIP] Error processing record ${record?.record_id}:`,
                err
              );
            })
            .finally(() => {
              activeStreams.delete(streamPromise);
            });
        }

        // Get next record
        const next = await iterator.next();
        record = next.record;
        done = next.done;
      }

      // Wait for at least one stream to complete before continuing
      if (activeStreams.size > 0) {
        await Promise.race(activeStreams);
      }
    }

    // Handle empty archive case
    if (fileCount === 0) {
      console.log('[ZIP] No attachments found, aborting archive');
      archive.abort();
      return;
    }

    // All files have been added and streams completed - now finalize
    console.log(`[ZIP] Finalizing archive with ${fileCount} files`);
    await archive.finalize();

    logMemory(
      'COMPLETE',
      `Successfully archived ${fileCount} files from ${recordCount} records`
    );
  } catch (error) {
    console.error('[ZIP] Fatal error during archive creation:', error);
    throw new Error(
      `Failed to create ZIP archive: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * Creates a notebook record iterator configured for attachment streaming.
 */
async function createNotebookRecordIterator(
  projectId: ProjectID,
  viewID: string,
  includeAttachments = true
) {
  const dataDb = await getDataDb(projectId);
  const uiSpecification = await getProjectUIModel(projectId);

  return notebookRecordIterator({
    projectId,
    filterDeleted: true,
    dataDb,
    uiSpecification,
    viewID,
    // Explicitly exclude attachment data to avoid loading large batches into
    // memory
    includeAttachments,
  });
}

/**
 * Creates and configures an archiver instance with proper event handlers.
 */
function createConfiguredArchive(
  outputStream: NodeJS.WritableStream
): archiver.Archiver {
  const archive = archiver('zip', {zlib: {level: 9}});

  // Handle non-fatal warnings
  archive.on('warning', err => {
    if (err.code === 'ENOENT') {
      console.warn('[ZIP] File not found warning:', err.message);
    } else {
      throw err;
    }
  });

  // Handle fatal errors
  archive.on('error', err => {
    console.error('[ZIP] Archive error:', err);
    throw err;
  });

  // Pipe archive output to response stream
  archive.pipe(outputStream);

  return archive;
}

/**
 * Processes a single record and adds all its attachments to the archive.
 */
async function processRecord(
  record: HydratedDataRecord,
  nanoDb: any,
  archive: archiver.Archiver,
  filenames: string[],
  recordCount: number,
  fileCount: number
): Promise<void> {
  // Iterate through all fields in the record
  for (const fieldId of Object.keys(record.data)) {
    const fieldType = record.types[fieldId];

    console.log(
      `[ZIP] Processing record ${record.record_id}, field ${fieldId} of type ${fieldType}. Data ${JSON.stringify(record.data[fieldId])}`
    );

    // Skip non-attachment fields
    if (fieldType !== 'faims-attachment::Files') {
      continue;
    }

    // Get the attachment list (shallowly hydrated)
    const attachmentList = record.data[fieldId] as
      | {
          attachment_id: string;
          filename: string;
          file_type: string;
        }[]
      | null;

    if (attachmentList === null) {
      // we have a null attachment - probably just not finished
      continue;
    }

    // Process each attachment in the list
    for (const {attachment_id, file_type} of attachmentList) {
      logMemory(
        'PROCESSING',
        `Record ${recordCount} (${record.record_id}): ${attachment_id}`
      );

      // Generate a unique filename for the attachment
      const fullFileName = generateFilenameForAttachment({
        filenames,
        fileMimeType: file_type,
        hrid: record.hrid ?? record.record_id,
        key: fieldId,
      });

      // Stream the attachment directly from the database into the archive
      const fileReadStream = nanoDb.attachment.getAsStream(
        attachment_id,
        attachment_id
      );

      archive.append(fileReadStream, {name: fullFileName});

      // Wait for the stream to complete
      await new Promise<void>((resolve, reject) => {
        fileReadStream.on('end', () => {
          logMemory('ADDED', `File ${fileCount + 1}: ${fullFileName}`);
          resolve();
        });
        fileReadStream.on('error', (err: any) => {
          console.error(`[ZIP] Stream error for ${fullFileName}:`, err);
          reject(err);
        });
      });
    }
  }
}

/**
 * Logs current memory usage during development/debugging.
 * Only active when DEVELOPER_MODE is enabled.
 */
function logMemory(stage: string, extraInfo = ''): void {
  if (!DEVELOPER_MODE) return;

  const used = process.memoryUsage();
  const formatMB = (bytes: number) => Math.round(bytes / 1024 / 1024);

  console.log(
    `[ZIP ${stage}] ${extraInfo}\n` +
      `  RSS: ${formatMB(used.rss)} MB\n` +
      `  Heap Used: ${formatMB(used.heapUsed)} MB / ${formatMB(used.heapTotal)} MB\n` +
      `  ArrayBuffers: ${formatMB(used.arrayBuffers)} MB\n` +
      `  External: ${formatMB(used.external)} MB`
  );
}

export const generateFilenameForAttachment = ({
  file,
  fileMimeType,
  key,
  hrid,
  filenames,
}: {
  file?: File;
  fileMimeType?: string;
  key: string;
  hrid: string;
  filenames: string[];
}) => {
  const fileTypes: {[key: string]: string} = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/tiff': 'tif',
    'text/plain': 'txt',
    'application/pdf': 'pdf',
    'application/json': 'json',
  };

  const type = file?.type || fileMimeType || undefined;
  const extension = type ? fileTypes[type] : 'dat';
  let filename = `${key}/${hrid}-${key}.${extension}`;
  let postfix = 1;
  while (filenames.find(f => f === filename)) {
    filename = `${key}/${hrid}-${key}_${postfix}.${extension}`;
    postfix += 1;
  }
  return filename;
};
