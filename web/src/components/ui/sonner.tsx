import {useTheme} from 'next-themes';
import {Toaster as Sonner} from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({...props}: ToasterProps) => {
  const {theme = 'system'} = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          // Set toast border and text colour styles
          success: '!border-success !text-success',
          error: '!border-destructive !text-destructive',
          warning: '!border-warning !text-warning',
          info: '!border-info !text-info',
          loading: '!border-info !text-info',
        },
      }}
      {...props}
    />
  );
};

export {Toaster};
