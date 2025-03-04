/**
 * Divider component renders a divider with a word.
 * It provides a way to display a divider with a word.
 *
 * @param {string} word - The word to display.
 * @returns {JSX.Element} The rendered Divider component.
 */
export const Divider = ({word}: {word?: string}) => {
  return (
    <div className="flex items-center">
      <div className="bg-input h-px flex-1" />
      {word && <div className="text-sm text-input px-2">{word}</div>}
      <div className="bg-input h-px flex-1" />
    </div>
  );
};
