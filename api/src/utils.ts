/**
 * Enhances an error with additional context while preserving the original error.
 * @param message The additional context message for the new error.
 * @param originalError The original error that was caught.
 * @returns A new error with the additional context and the original error as its cause.
 */
export function enhanceError(message: string, originalError: unknown): Error {
  // If the original error is not an Error instance, wrap it in one
  const errorObject =
    originalError instanceof Error
      ? originalError
      : new Error(String(originalError));

  const enhancedError = new Error(message);
  enhancedError.cause = errorObject;

  // Preserve the stack trace if possible
  if (errorObject.stack) {
    enhancedError.stack = `${enhancedError.stack}\n\nCaused by:\n${errorObject.stack}`;
  }

  return enhancedError;
}

/**
 * Slugify a string, replacing special characters with less special ones
 * @param str input string
 * @returns url safe version of the string
 * https://ourcodeworld.com/articles/read/255/creating-url-slugs-properly-in-javascript-including-transliteration-for-utf-8
 */
export const slugify = (str: string) => {
  str = str.trim();
  str = str.toLowerCase();

  // remove accents, swap ñ for n, etc
  const from = 'ãàáäâáº½èéëêìíïîõòóöôùúüûñç·/_,:;';
  const to = 'aaaaaeeeeeiiiiooooouuuunc------';
  for (let i = 0, l = from.length; i < l; i++) {
    str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
  }

  str = str
    .replace(/[^a-z0-9 -]/g, '') // remove invalid chars
    .replace(/\s+/g, '-') // collapse whitespace and replace by -
    .replace(/-+/g, '-'); // collapse dashes

  return str;
};