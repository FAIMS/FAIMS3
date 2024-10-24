/**
 * Scrolls smoothly to the HTMLDivElement referenced by the given ref.
 *
 * @param {React.RefObject<HTMLDivElement>} ref - A reference to the target HTMLDivElement.
 *                                                The function will scroll to this element if it exists.
 */
export const scrollToDiv = (ref: React.RefObject<HTMLDivElement>) =>
  ref.current &&
  ref.current.scrollIntoView({
    behavior: 'smooth',
    block: 'end',
  });

/**
 * Gets the parent path of a given pathname based on its structure.
 *
 * Depending on the length of the split path, this function determines the
 * appropriate parent path to return. If the pathname represents a record edit
 * or draft screen, it slices the pathname to return the survey screen path.
 *
 * @param {string} pathname - The full pathname from which to derive the parent path.
 * @returns {string} - The derived parent path or root ("/") if no match is found.
 */
export const getParentPath = (pathname: string) => {
  const splitPath = pathname.split('/');

  switch (splitPath.length) {
    case 7:
      // From: record edit screen
      // To: survey screen
      return splitPath.slice(0, 3).join('/');
    case 9:
      // From: record draft screen
      // To: survey screen
      return splitPath.slice(0, 3).join('/');
    default:
      return '/';
  }
};
