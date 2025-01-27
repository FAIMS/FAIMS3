/**
 * Pauses execution for a given number of milliseconds.
 * @param {number} ms - The number of milliseconds to sleep.
 * @returns {Promise<void>} A promise that resolves after the specified duration.
 */
export async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
