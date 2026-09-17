// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: logging.ts
 * Description:
 *   Wrappers for logging functions for errors etc.
 */

// TODO: removed bugsnag from here but the frontend will want to
// report errors that way - need to pass in an error logger?

export const logError = (error: any) => {
  console.error(error);
};

export const logWarn = (...args: unknown[]) => {
  console.warn(...args);
};

let attachmentSaveTraceEnabled = false;

/** Enable or disable attachment-save trace output (typically from DEBUG_APP). */
export function setAttachmentSaveTraceEnabled(enabled: boolean): void {
  attachmentSaveTraceEnabled = enabled;
}

export function isAttachmentSaveTraceEnabled(): boolean {
  return attachmentSaveTraceEnabled;
}

/** Writes attachment-save pipeline stages to stdout when tracing is enabled. */
export function attachmentSaveTrace(
  stage: string,
  details?: Record<string, unknown>
): void {
  if (!attachmentSaveTraceEnabled) {
    return;
  }
  const line = `[attachment-save-trace] ${new Date().toISOString()} ${stage}`;
  if (details !== undefined) {
    console.log(line, details);
  } else {
    console.log(line);
  }
}
