Now I have a complete picture. Let me analyze all the bugs and write the fixes.

Root Causes
Bug 1: throw inside event handlers in createConfiguredArchive

Both the 'warning' and 'error' handlers throw:

archive.on('error', err => {
  throw err; // WRONG - uncaught exception in event handler!
});
archive.on('warning', err => {
  // ...
  throw err; // WRONG
});
Throwing inside an event listener bypasses the promise chain. The await archive.finalize() never rejects - the error becomes an uncaught exception that goes to process.on('uncaughtException'). The streamFullExport async function is now stuck at await archive.finalize() (or wherever it is when the error occurs).

Bug 2: Source streams that never emit 'end'

When archiver encounters an error and stops reading, any streams queued but not yet consumed never signal completion. The promises waiting for those 'end' events hang indefinitely, so Promise.race(activeStreams) never resolves and the attachment appending gets stuck.

Bug 3: No cleanup

When the archive fails—say the client disconnects and writing to the response fails—archiver stops consuming the queued source streams. Those CouchDB HTTP streams stay open indefinitely, tying up connections in the pool and blocking subsequent requests from getting connections.

These three bugs combine to create the exact symptom: a large download triggers a client disconnect, which causes the archive to error, which throws in the event handler and breaks the async chain, leaving appendAttachmentsToArchive stuck at Promise.race while CouchDB connections remain held open, starving other requests.

The fix starts with createConfiguredArchive: instead of throwing errors in the handlers, I should log them so the error can still propagate through the normal channels.

For processRecordAttachments, I need to switch to listening for the 'close' event on streams since it fires both on normal completion and when streams are destroyed, ensuring destroyed streams properly reject instead of hanging indefinitely.

In appendAttachmentsToArchive, I'll track active source streams and destroy them all when the archive errors, which releases the CouchDB connections. The finally block should also clean up any remaining streams.

streamFullExport needs to handle when the client closes the connection and abort the archive accordingly.

Even with these fixes in place, I should consider what happens if the archive properly aborts and destroys the CouchDB streams—there's still the question of why subsequent requests fail.

Looking at how nano works, attachment.getAsStream() returns an HTTP readable stream backed by a connection. Calling .destroy() on it aborts the request and closes the connection, returning it to the pool for reuse.

Now I'm ready to implement the actual changes to attachmentExport.ts.

Implementing the fixes... I'm refining the error handling in the archive event listeners—instead of throwing errors in the warning handler, I'm logging them to avoid uncaught exceptions that would hang the export process, and I'm updating the processRecordAttachments function signature to include an activeSourceStreams parameter for better stream management. I'm refactoring the stream handling to track the stream lifecycle more carefully—adding it to an active set so it can be cleaned up if the archive fails, and switching from 'end' to 'close' events since 'end' won't fire if the archiver stops reading the stream prematurely.

Setting up error handling and cleanup logic... I need to use a named function reference so I can properly remove the error listener in the finally block—since





There are three distinct root causes working together:

throw inside event handlers — archive.on('error', err => { throw err }) fires inside a Node.js EventEmitter callback. The throw escapes every Promise chain, so await archive.finalize() and await Promise.race(activeStreams) are left permanently pending.

Stream promises resolve only on 'end' — When archiver errors and stops reading its queue, the queued CouchDB source streams never get consumed, so 'end' never fires. Their promises hang forever, permanently blocking Promise.race(activeStreams).

No cleanup of open CouchDB HTTP streams — Each nanoDb.attachment.getAsStream() keeps an HTTP connection open until the stream is fully consumed. If archiver stops mid-queue, those connections are never freed, exhausting the pool and causing subsequent requests to hang too — even small ones.

The fix has five parts: remove the throw, add an activeSourceStreams registry destroyed on archive error, change promises to use 'close' (which fires on destruction), use a non-rejecting safePromise for individual stream errors, and add a client-disconnect handler in streamFullExport.






Here's a summary of the three root causes found and the five targeted fixes applied across attachmentExport.ts and fullExport.ts:

Root cause 1 — throw inside EventEmitter handlers
archive.on('error', err => { throw err }) runs synchronously inside a Node.js EventEmitter callback. It is never caught by any surrounding Promise chain — it becomes an unhandled exception that leaves await archive.finalize() and await Promise.race(...) permanently pending.

Fix: Changed both the 'error' and 'warning' handlers in createConfiguredArchive to console.error/console.warn only.

Root cause 2 — Stream promises only resolved on 'end'
fileReadStream.on('end', resolve) only fires after the consumer (archiver) has fully read the stream. When archiver errors and stops reading its queue, the queued CouchDB streams are never consumed, 'end' never fires, and Promise.race(activeStreams) hangs forever.

Fix: Changed each stream promise to use 'close' (which fires whether the stream ends normally or is destroyed) with a flag to distinguish the two cases. Also: individual per-stream errors are now caught by a safePromise wrapper and turned into warnings rather than propagating to Promise.race.

Root cause 3 — No cleanup of open CouchDB HTTP connections
Each nanoDb.attachment.getAsStream() holds an HTTP connection to CouchDB until the stream is fully read. When archiver stops mid-queue, those connections are abandoned. After a few large failed downloads the CouchDB HTTP connection pool is exhausted, causing all subsequent requests (even small ones) to hang — explaining "restart fixes it".

Fix (two-part):

activeSourceStreams registry + archiveErrorSignal: When the archive emits 'error', every registered source stream is .destroy()'d immediately (releasing their CouchDB connections), then archiveErrorSignal rejects, which the concurrency loop's Promise.race([...activeStreams, archiveErrorSignal]) picks up and exits cleanly. A finally block destroys any stragglers.
onResClose in streamFullExport: When the HTTP client disconnects, res.close fires, which calls archive.emit('error', ...) (triggering the above cleanup chain) then archive.abort() (killing archiver's queue). The listener is removed just before archive.finalize() so a normally-completing response doesn't trigger cleanup.