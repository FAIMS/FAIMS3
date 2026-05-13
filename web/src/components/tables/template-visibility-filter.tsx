import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type TemplateVisibilityFilterValue = 'all' | 'public' | 'private';

export function filterTemplatesByVisibility<T extends {isPublic?: boolean}>(
  templates: T[] | undefined,
  filter: TemplateVisibilityFilterValue
): T[] {
  const list = templates ?? [];
  if (filter === 'all') {
    return list;
  }
  if (filter === 'public') {
    return list.filter(t => t.isPublic === true);
  }
  return list.filter(t => t.isPublic !== true);
}

/** Subtle row tint for catalogue-public templates in list tables. */
export const PUBLIC_TEMPLATE_ROW_CLASS =
  'bg-emerald-500/[0.06] hover:bg-emerald-500/[0.11] dark:bg-emerald-500/[0.11] dark:hover:bg-emerald-500/[0.17]';

export function TemplateVisibilityFilterSelect({
  value,
  onValueChange,
}: {
  value: TemplateVisibilityFilterValue;
  onValueChange: (next: TemplateVisibilityFilterValue) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={v => onValueChange(v as TemplateVisibilityFilterValue)}
    >
      <SelectTrigger
        className="w-[11rem]"
        aria-label="Filter by catalogue visibility"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All templates</SelectItem>
        <SelectItem value="public">Public only</SelectItem>
        <SelectItem value="private">Private only</SelectItem>
      </SelectContent>
    </Select>
  );
}
