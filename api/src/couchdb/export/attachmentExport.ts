import {
  ProjectID,
  notebookRecordIterator,
  HydratedDataRecord,
} from '@faims3/data-model';
import archiver from 'archiver';
import {getNanoDataDb, getDataDb} from '..';
import {getProjectUIModel} from '../notebooks';

/**
 * Maximum number of file streams to process concurrently when building the ZIP archive.
 */
const MAX_CONCURRENT_STREAMS = 15;

/**
 * Streams notebook files as a ZIP archive directly to a writable stream.
 *
 * This function uses streaming and bounded concurrency to handle large
 * datasets without loading all files into memory. It's designed to work with
 * notebook records that may contain hundreds or thousands of attachments.
 *
 * Architecture:
 * 1. Iterates through notebook records one at a time
 * 2. For each record, processes attachment fields
 * 3. Streams file data directly from database → archive → output stream
 * 4. Maintains a pool of concurrent streams (bounded by MAX_CONCURRENT_STREAMS)
 * 5. Waits for completion of all streams before finalizing the archive
 *
 * Memory Safety:
 * - Files are streamed, not buffered entirely in memory
 * - Concurrency limits prevent too many simultaneous file operations
 * - Attachment data is excluded from record hydration
 *
 * File Structure:
 * - Single view mode: `fieldId/hrid-fieldId.ext` (e.g., `photo/REC001-photo.jpg`)
 * - Multi view mode: `viewId/fieldId/hrid-fieldId.ext` (e.g., `survey1/photo/REC001-photo.jpg`)
 *
 * @param projectId - The ID of the project containing the notebook
 * @param targetViewID - The ID of the view to export (if omitted, exports all views)
 * @param res - The writable stream (typically an HTTP response) to pipe the ZIP to
 *
 * @throws Error if database access fails or archiving encounters an error
 */
export const streamNotebookFilesAsZip = async ({
  projectId,
  targetViewID,
  res,
}: {
  projectId: ProjectID;
  targetViewID?: string;
  res: NodeJS.WritableStream;
}): Promise<void> => {
  // Statistics tracking for logging and debugging
  let fileCount = 0;

  try {
    // If we have a view ID specified, then use only that iterator - otherwise
    // go through all of them
    let relevantViews: string[] = [];
    if (!targetViewID) {
      // Get the ui spec
      const uiSpec = await getProjectUIModel(projectId);

      // Find the relevant viewset IDs
      relevantViews = Array.from(Object.keys(uiSpec.viewsets));
    } else {
      relevantViews = [targetViewID];
    }

    // Create ZIP archive with maximum compression
    const archive = createConfiguredArchive(res);

    // Initialize database connection and create record iterator
    const nanoDb = await getNanoDataDb(projectId);

    // Pool of active file streaming promises for concurrency management
    const activeStreams = new Set<Promise<void>>();

    for (const viewID of relevantViews) {
      // Get an efficient iterator of all notebook records (attachments not DL'd)
      const iterator = await createNotebookRecordIterator(
        projectId,
        viewID,
        false // Critical: exclude attachment data to avoid memory bloat
      );

      // Track all filenames to prevent collisions in the archive
      const filenames: string[] = [];

      // Begin iteration
      let {record, done} = await iterator.next();

      /**
       * Main processing loop with bounded concurrency.
       *
       * This loop continues until:
       * 1. No more records to process (done === true), AND
       * 2. All active streams have completed (activeStreams.size === 0)
       */
      while (!done || activeStreams.size > 0) {
        // Fill the stream pool up to the concurrency limit
        while (!done && activeStreams.size < MAX_CONCURRENT_STREAMS) {
          if (record !== null) {
            // Start processing this record's attachments asynchronously
            const streamPromises = processRecord({
              viewID,
              record,
              nanoDb,
              archive,
              filenames,
            });

            // Add to active pool and set up cleanup handlers
            for (const streamPromise of streamPromises) {
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
          }

          // Advance to next record
          const next = await iterator.next();
          record = next.record;
          done = next.done;
        }

        /**
         * Wait for at least one stream to complete before continuing.
         * This prevents the loop from spinning when at max concurrency.
         */
        if (activeStreams.size > 0) {
          await Promise.race(activeStreams);
        }
      }
    }

    // Handle edge case: no attachments found in any records
    if (fileCount === 0) {
      console.log('[ZIP] No attachments found, aborting archive creation');
      archive.abort();
      return;
    }

    /**
     * Finalize the archive only after ALL streams have completed.
     * Finalizing too early will result in a corrupted ZIP file.
     */
    await archive.finalize();
  } catch (error) {
    console.error('[ZIP] Fatal error during archive creation:', error);
    throw new Error(
      `Failed to create ZIP archive: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * Creates a notebook record iterator configured for efficient attachment streaming.
 *
 * IMPORTANT: Sets includeAttachments=false to avoid loading attachment binary data
 * into memory during iteration. We only need metadata (attachment_id, filename, type)
 * which is included in the record structure regardless of this flag.
 *
 * @param projectId - The project identifier
 * @param viewID - The view identifier for filtering
 * @param includeAttachments - Whether to load full attachment data (always false for streaming)
 * @returns An async iterator over hydrated records
 */
async function createNotebookRecordIterator(
  projectId: ProjectID,
  viewID: string,
  includeAttachments = false
) {
  const dataDb = await getDataDb(projectId);
  const uiSpecification = await getProjectUIModel(projectId);

  return notebookRecordIterator({
    projectId,
    filterDeleted: true, // Exclude deleted records from export
    dataDb,
    uiSpecification,
    viewID,
    includeAttachments, // False to prevent memory bloat from large attachments
  });
}

/**
 * Creates and configures an archiver instance with proper error handling.
 *
 * Configuration:
 * - Format: ZIP
 * - Compression level: 9 (maximum compression)
 * - Error handling: Warnings logged, errors thrown
 *
 * @param outputStream - The destination stream for the ZIP archive
 * @returns Configured archiver instance ready to accept files
 */
function createConfiguredArchive(
  outputStream: NodeJS.WritableStream
): archiver.Archiver {
  const archive = archiver('zip', {
    zlib: {level: 1}, // Minimum compression for speed - PNGs/JPEGs are already compressed
  });

  // Handle non-fatal warnings (e.g., file not found)
  archive.on('warning', err => {
    if (err.code === 'ENOENT') {
      console.warn('[ZIP] File not found warning:', err.message);
    } else {
      // Unknown warning types should be treated as errors
      throw err;
    }
  });

  // Handle fatal errors during archive creation
  archive.on('error', err => {
    console.error('[ZIP] Archive error:', err);
    throw err;
  });

  // Connect archive output to the destination stream
  archive.pipe(outputStream);

  return archive;
}

/**
 * Processes a single record and adds all its attachments to the archive.
 *
 * This function:
 * 1. Iterates through all fields in the record
 * 2. Identifies attachment fields by type
 * 3. For each attachment, generates a unique filename
 * 4. Streams the file data from database directly into the archive
 * 5. Returns promises for all streams initiated
 *
 * The returned promises allow the caller to manage concurrency across multiple
 * records while still processing attachments within a single record in parallel.
 *
 * @param record - The hydrated data record containing field metadata
 * @param nanoDb - Database instance for streaming attachment data
 * @param archive - The archiver instance to append files to
 * @param filenames - Array tracking all filenames to prevent duplicates
 * @param recordCount - Current record number (for logging)
 * @param fileCount - Current file number (for logging)
 * @param viewID - The view identifier (used in multi-view mode for folder structure)
 * @param includeViewIDPrefix - Whether to include viewID in the file path
 * @returns Array of promises, one for each attachment stream initiated
 */
function processRecord({
  record,
  nanoDb,
  archive,
  filenames,
  viewID,
}: {
  record: HydratedDataRecord;
  nanoDb: any;
  archive: archiver.Archiver;
  filenames: string[];
  viewID: string;
}): Promise<void>[] {
  const promises: Promise<void>[] = [];

  // Iterate through all fields in the record's data
  for (const fieldId of Object.keys(record.data)) {
    const fieldType = record.types[fieldId];

    // Only process attachment fields
    if (fieldType !== 'faims-attachment::Files') {
      continue;
    }

    /**
     * Get the attachment list. Each attachment has:
     * - attachment_id: Database identifier for the file
     * - filename: Original filename (unused in current implementation)
     * - file_type: MIME type for determining file extension
     */
    const attachmentList = record.data[fieldId] as
      | {
          attachment_id: string;
          filename: string;
          file_type: string;
        }[]
      | null;

    // Null indicates an incomplete or pending attachment field
    if (attachmentList === null) {
      continue;
    }

    // Process each attachment in the field
    for (const {attachment_id, file_type} of attachmentList) {
      // Generate a unique, collision-free filename for the archive
      const fullFileName = generateFilenameForAttachment({
        filenames,
        fileMimeType: file_type,
        hrid: record.hrid ?? record.record_id,
        fieldId,
        viewID,
      });

      // Track this filename to prevent duplicates
      filenames.push(fullFileName);

      /**
       * Stream the attachment directly from database into the archive.
       * This avoids loading the entire file into memory.
       *
       * The database returns a readable stream that we pipe into the archiver.
       */
      const fileReadStream = nanoDb.attachment.getAsStream(
        attachment_id,
        attachment_id
      );

      // Add the stream to the archive with the generated filename
      archive.append(fileReadStream, {name: fullFileName});

      /**
       * Create a promise that resolves when the stream completes.
       * These promises are returned to the caller for concurrency management.
       */
      const streamPromise = new Promise<void>((resolve, reject) => {
        fileReadStream.on('end', () => {
          resolve();
        });
        fileReadStream.on('error', (err: any) => {
          console.error(`[ZIP] Stream error for ${fullFileName}:`, err);
          reject(err);
        });
      });

      promises.push(streamPromise);
    }
  }

  return promises;
}

/**
 * Generates a unique filename for an attachment within the ZIP archive.
 *
 * Filename structure:
 * - Single view mode: `{fieldId}/{hrid}-{fieldId}.{extension}`
 *   Example: `photo/REC001-photo.jpg`
 * - Multi view mode: `{viewID}/{fieldId}/{hrid}-{fieldId}.{extension}`
 *   Example: `survey1/photo/REC001-photo.jpg`
 *
 * If a filename collision is detected, a numeric suffix is appended:
 * `photo/REC001-photo_1.jpg`, `photo/REC001-photo_2.jpg`, etc.
 *
 * This structure:
 * - Groups files by field type in subdirectories
 * - In multi-view mode, adds an additional layer grouping by view
 * - Makes filenames human-readable and sortable
 * - Preserves information about the source record and field
 *
 * @param file - Optional File object (for browser contexts)
 * @param fileMimeType - MIME type of the file
 * @param fieldId - Field identifier (used in filename and directory)
 * @param hrid - Human-readable record ID
 * @param viewID - Optional view identifier (used in multi-view mode)
 * @param filenames - Array of existing filenames to check for collisions
 * @returns A unique filename safe for use in the ZIP archive
 */
export const generateFilenameForAttachment = ({
  file,
  fileMimeType,
  fieldId,
  hrid,
  viewID,
  filenames,
}: {
  file?: File;
  fileMimeType?: string;
  fieldId: string;
  hrid: string;
  viewID: string;
  filenames: string[];
}): string => {
  // Mapping of MIME types to file extensions
  const fileTypes: {[key: string]: string} = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/tiff': 'tif',
    'text/plain': 'txt',
    'application/pdf': 'pdf',
    'application/json': 'json',
  };

  // Determine MIME type from File object or explicit parameter
  const type = file?.type || fileMimeType || undefined;

  // Look up extension, default to 'dat' for unknown types
  const extension = type ? fileTypes[type] : 'dat';

  // Generate base filename with consistent structure
  // Multi-view mode: viewID/fieldId/hrid-fieldId.ext
  // Single-view mode: fieldId/hrid-fieldId.ext
  const baseFilename = `${viewID}/${fieldId}/${hrid}`;

  const slugify = (filename: string) => {
    return (
      filename
        // replace spaces with underscores
        .replace(/\s+/g, '_')
        // remove any unsafe characters
        .replace(/[^a-zA-Z0-9\][_/-]/g, '_')
    );
  };

  // Handle collisions by appending numeric suffix
  let postfix = 1;
  let fullFilename = `${slugify(baseFilename)}.${extension}`;
  while (filenames.includes(fullFilename)) {
    fullFilename = `${slugify(baseFilename)}_${postfix}.${extension}`;
    postfix += 1;
  }

  console.log(`[ZIP] Generated filename: ${fullFilename}`);
  return fullFilename;
};
