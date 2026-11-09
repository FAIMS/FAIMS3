// SPDX-License-Identifier: Apache-2.0

/**
 * POST helper for in-app feedback from the data-collection app.
 */

import {
  FeedbackCategory,
  FeedbackSource,
  INPUT_LIMITS,
  PostFeedbackRequest,
  PostFeedbackResponseSchema,
} from '@faims3/data-model';
import {config} from '../../../buildconfig';

export const FEEDBACK_OFFLINE_MESSAGE =
  'Feedback needs a network connection. Try again when you are online.';
export const FEEDBACK_RATE_LIMIT_MESSAGE =
  'Too many feedback submissions. Please try again later.';
export const FEEDBACK_GENERIC_ERROR_MESSAGE =
  'Could not send feedback. Please try again.';
export const FEEDBACK_SUCCESS_MESSAGE =
  'Thank you. Your feedback has been sent.';

/** Truncate a diagnostic string to the shared schema cap. */
export function truncateDiagnostic(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

/**
 * Bounded diagnostics plus the user message. Identity is not included —
 * Conductor reads it from the access token.
 */
export function buildAppFeedbackPayload({
  message,
  source,
  category,
}: {
  message: string;
  source: FeedbackSource;
  category?: FeedbackCategory;
}): PostFeedbackRequest {
  const payload: PostFeedbackRequest = {
    message,
    source,
    path: truncateDiagnostic(
      typeof window === 'undefined' ? '' : window.location.href,
      INPUT_LIMITS.REDIRECT_URL_MAX_LENGTH
    ),
    clientVersion: truncateDiagnostic(
      config.appVersion,
      INPUT_LIMITS.SHORT_TEXT_MAX_LENGTH
    ),
    userAgent: truncateDiagnostic(
      typeof navigator === 'undefined' ? '' : (navigator.userAgent ?? ''),
      INPUT_LIMITS.SHORT_TEXT_MAX_LENGTH
    ),
  };
  if (category) {
    payload.category = category;
  }
  return payload;
}

export type SubmitFeedbackResult =
  | {ok: true}
  | {ok: false; status: number; message: string};

/**
 * POST `{conductorUrl}/api/feedback` with the bearer token.
 * Does not catch network failures — callers distinguish those from HTTP errors.
 */
export async function postFeedback({
  conductorUrl,
  token,
  body,
}: {
  conductorUrl: string;
  token: string;
  body: PostFeedbackRequest;
}): Promise<SubmitFeedbackResult> {
  const response = await fetch(`${conductorUrl}/api/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429) {
    return {ok: false, status: 429, message: FEEDBACK_RATE_LIMIT_MESSAGE};
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: FEEDBACK_GENERIC_ERROR_MESSAGE,
    };
  }

  PostFeedbackResponseSchema.parse(await response.json());
  return {ok: true};
}
