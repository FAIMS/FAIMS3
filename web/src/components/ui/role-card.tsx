import {cn} from '@/lib/utils';
import {X} from 'lucide-react';

/**
 * Role component renders a role in a table cell.
 *
 * @param {string} role - The role to render.
 * @returns {JSX.Element} The rendered Role component.
 */
export function RoleCard({
  children,
  onClick,
  onRemove,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'group relative cursor-default bg-muted text-muted-foreground px-2 py-1 rounded-md w-fit hover:bg-muted/90 transition-colors',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
      {onRemove && (
        <button
          className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onRemove}
          aria-label="Remove"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
