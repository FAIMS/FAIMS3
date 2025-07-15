import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import {cn} from '@/lib/utils';
import {Label} from '@/components/ui/label';

const List = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({className, ...props}, ref) => (
  <div
    ref={ref}
    className={cn('space-y-3 flex flex-col justify-between h-full', className)}
    {...props}
  />
));
List.displayName = 'List';

const ListItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({className, ...props}, ref) => (
  <div ref={ref} className={cn('space-y-1', className)} {...props} />
));
ListItem.displayName = 'ListItem';

const ListLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({className, ...props}, ref) => {
  return <Label ref={ref} className={className} {...props} />;
});
ListLabel.displayName = 'ListLabel';

const ListDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({className, ...props}, ref) => {
  return (
    <div
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
});
ListDescription.displayName = 'ListDescription';

export {List, ListItem, ListLabel, ListDescription};
