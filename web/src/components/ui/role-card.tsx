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
        'relative cursor-default bg-muted text-muted-foreground px-2 py-1 rounded-md w-fit hover:bg-muted/90 transition-colors',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
      {onRemove && (
        <button
          className="absolute -top-2 p-0.5 hover:bg-muted border text-primary rounded-full bg-background -right-2"
          onClick={onRemove}
          aria-label="Remove"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
