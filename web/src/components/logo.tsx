import {cn} from '@/lib/utils';
import {Flame} from 'lucide-react';

export default function Logo({className}: {className?: string}) {
  return (
    <div className="flex gap-2">
      <div
        className={cn(
          'flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground',
          className
        )}
      >
        <Flame className="size-4" />
      </div>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-semibold">BSS</span>
        <span className="truncate text-xs">Bushfire Surveyor System</span>
      </div>
    </div>
  );
}
