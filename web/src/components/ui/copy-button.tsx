import {useEffect, useState} from 'react';
import {Button, ButtonProps} from './button';
import {cn} from '@/lib/utils';
import {CheckIcon, ClipboardIcon} from 'lucide-react';

interface CopyButtonProps extends ButtonProps {
  value: string;
  src?: string;
}

export function CopyButton({
  value,
  className,
  variant = 'ghost',
  children,
  ...props
}: CopyButtonProps) {
  const [hasCopied, setHasCopied] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setHasCopied(false);
    }, 2000);
  }, [hasCopied]);

  return (
    <Button
      variant={variant}
      className={cn(className, 'p-0 hover:bg-inherit font-normal text-xs')}
      onClick={() => {
        navigator.clipboard.writeText(value);
        setHasCopied(true);
      }}
      {...props}
    >
      {children}
      {hasCopied ? <CheckIcon /> : <ClipboardIcon />}
    </Button>
  );
}
