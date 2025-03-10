import {CircleX} from 'lucide-react';

/**
 * Role component renders a role in a table cell.
 *
 * @param {string} role - The role to render.
 * @returns {JSX.Element} The rendered Role component.
 */
export default function RoleCard({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <div className="group relative cursor-default bg-muted text-muted-foreground px-2 py-1 rounded-md w-fit hover:bg-muted/90 transition-colors">
      {children}
      {onRemove && (
        <button
          className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onRemove}
          aria-label="Remove"
        >
          <CircleX className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
