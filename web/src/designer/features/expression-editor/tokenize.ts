// SPDX-License-Identifier: Apache-2.0
/**
 * @file Splits an expression into text and complete `{ref}` segments.
 *
 * Used by tests and as a readable view of {@link scanExpressionReferences}.
 * The live editor scans the document directly in the ViewPlugin.
 */

import {scanExpressionReferences} from '@faims3/data-model';

/** Operator / literal run between refs. `to` is exclusive. */
export type ExprTextSegment = {
  kind: 'text';
  /** Source slice for this run. */
  value: string;
  from: number;
  to: number;
};

/** One complete `{ref}` span. `to` is exclusive and includes the braces. */
export type ExprRefSegment = {
  kind: 'ref';
  /** Inner id, without braces. */
  ref: string;
  from: number;
  to: number;
};

/** One token from {@link tokenizeExpression}, in source order. */
export type ExprSegment = ExprTextSegment | ExprRefSegment;

/**
 * Walks {@link scanExpressionReferences} and emits intervening text.
 *
 * @param source - Raw expression, e.g. `{f_ab} * 2`.
 * @returns Segments in source order. Incomplete `{foo` stays a text segment.
 */
export const tokenizeExpression = (source: string): ExprSegment[] => {
  const spans = scanExpressionReferences(source);
  const segments: ExprSegment[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.from > cursor) {
      segments.push({
        kind: 'text',
        value: source.slice(cursor, span.from),
        from: cursor,
        to: span.from,
      });
    }
    segments.push({
      kind: 'ref',
      ref: span.ref,
      from: span.from,
      to: span.to,
    });
    cursor = span.to;
  }
  if (cursor < source.length) {
    segments.push({
      kind: 'text',
      value: source.slice(cursor),
      from: cursor,
      to: source.length,
    });
  }
  return segments;
};
