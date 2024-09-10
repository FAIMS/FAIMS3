
/**
 * Enhances an error with additional context while preserving the original error.
 * @param message The additional context message for the new error.
 * @param originalError The original error that was caught.
 * @returns A new error with the additional context and the original error as its cause.
 */
export function enhanceError(message: string, originalError: unknown): Error {
  // If the original error is not an Error instance, wrap it in one
  const errorObject = originalError instanceof Error ? originalError : new Error(String(originalError));

  const enhancedError = new Error(message);
  enhancedError.cause = errorObject;
  
  // Preserve the stack trace if possible
  if (errorObject.stack) {
    enhancedError.stack = `${enhancedError.stack}\n\nCaused by:\n${errorObject.stack}`;
  }

  return enhancedError;
}