/**
 * Abbreviates a title if it exceeds a certain length and a flag is not set.
 *
 * @param {string} title - The title to abbreviate.
 * @param {boolean} not_xs - If true, abbreviation will not occur even if the title is long.
 * @returns {string} - The abbreviated title if applicable, otherwise the original title.
 */
export const abbreviateTitle = (title: string, not_xs: boolean): string => {
  if (title.length > 10 && !not_xs) return title.substring(0, 7) + '...';

  return title;
};

/**
 * Removes a part of the listing title that is separated by '%7C%7C'.
 *
 * @param {string} title - The title from which a listing part should be removed.
 * @returns {string} - The title with the part after '%7C%7C' removed.
 */
export const removeListing = (title: string): string => {
  if (title.includes('%7C%7C')) return title.split('%7C%7C').join(' / ');

  return title;
};
