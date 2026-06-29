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
 * Filename: logging.ts
 * Description:
 *   Wrappers for logging functions for errors etc.
 */

// TODO: removed bugsnag from here but the frontend will want to
// report errors that way - need to pass in an error logger?

export const logError = (error: any) => {
  console.error(error);
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
