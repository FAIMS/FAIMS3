import {Capacitor} from '@capacitor/core';

/**
 * Input parameter checker to ensure all values are defined
 * @param vals Values to check
 * @returns Returns true iff no values are undefined or null
 */
export function checkAllRequired(vals: any[]): boolean {
  return !vals.some(v => v === undefined || v === null);
}

/**
 * Are we running on the web or mobile?
 * @returns true if we're running in a web browser, false if in an app
 */

export function isWeb() {
  return Capacitor.getPlatform() === 'web';
}

/**
 * Takes an element from an iterator
 * @param iterator The iterator to take first element from
 * @returns The first element of an iterator or undefined
 */
export function iteratorTakeOne<V>(iterator: Iterator<V>): V | undefined {
  const result = iterator.next();
  return result.done ? undefined : result.value;
}

/**
 * Either replaces or adds a redirect to a URL query string
 * @param url
 * @param redirectTo
 * @returns
 */
export const replaceOrAppendRedirect = ({
  url,
  redirectTo,
}: {
  url: string;
  redirectTo: string;
}): string => {
  try {
    // Parse the URL to manipulate its parts
    const urlObj = new URL(url);

    // Check if redirect parameter exists and replace it
    if (urlObj.searchParams.has('redirect')) {
      urlObj.searchParams.set('redirect', redirectTo);
    } else {
      // Add redirect parameter if it doesn't exist
      urlObj.searchParams.append('redirect', redirectTo);
    }

    return urlObj.toString();
  } catch (error) {
    // Return original URL if parsing fails
    console.error('Error parsing URL:', error);
    return url;
  }
};
