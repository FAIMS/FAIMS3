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
