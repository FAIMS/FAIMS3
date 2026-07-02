/**
 * @file Renders fuzzysort per-key match highlighting for designer search dropdowns.
 */

/** True when fuzzysort matched this key (not its empty placeholder result). */
export const hasFuzzysortKeyMatch = (
  match: Fuzzysort.Result | null | undefined
): boolean => !!match && match.score > 0;

/**
 * Renders fuzzysort highlight markup for one search key.
 * Falls back to plain text when the key did not match the query.
 */
export const renderFuzzysortHighlight = (
  match: Fuzzysort.Result | null | undefined,
  fallback: string
) => {
  if (!hasFuzzysortKeyMatch(match)) return fallback;
  return (
    <span
      dangerouslySetInnerHTML={{
        __html: match.highlight('<strong>', '</strong>'),
      }}
    />
  );
};
