import { useBreadcrumb } from '@/context/breadcrumb-provider';
import { useEffect } from 'react';

type UseBreadcrumbUpdateProps = {
  // highest -> lowest
  isLoading: boolean;
  paths: {path: string; label: string}[];
};

export function useBreadcrumbUpdate({
  paths,
  isLoading,
}: UseBreadcrumbUpdateProps) {
  const {setBreadcrumb, clearBreadcrumb} = useBreadcrumb();

  useEffect(() => {
    for (const p of paths) {
      setBreadcrumb(p.path, {label: p.label, isLoading});
    }

    return () => {
      for (const p of paths) {
        clearBreadcrumb(p.path);
      }
    };
  }, [paths, setBreadcrumb]);
}
