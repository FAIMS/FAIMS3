/**
 * useScreenSize.tsx
 *
 * Reusable hook to determine screen size and adjust pagination dynamically.
 * Useful for responsive MUI DataGrid layouts.
 */

import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useMemo} from 'react';

export type SizeCategory = 'xs' | 'sm' | 'md' | 'lg';

export const useScreenSize = () => {
  const theme = useTheme();

  const isXs = useMediaQuery(theme.breakpoints.only('xs'));
  const isSm = useMediaQuery(theme.breakpoints.only('sm'));
  const isMd = useMediaQuery(theme.breakpoints.only('md'));

  const currentSize = useMemo<SizeCategory>(() => {
    if (isXs) return 'xs';
    if (isSm) return 'sm';
    if (isMd) return 'md';
    return 'lg';
  }, [isXs, isSm, isMd]);

  const pageSize = useMemo(() => {
    const sizeMap: Record<SizeCategory, number> = {
      xs: 10,
      sm: 15,
      md: 20,
      lg: 25,
    };

    return (maxRows: number | null) =>
      maxRows !== null
        ? Math.min(maxRows, sizeMap[currentSize])
        : sizeMap[currentSize];
  }, [currentSize]);

  return {currentSize, pageSize};
};
