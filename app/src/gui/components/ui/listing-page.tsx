// SPDX-License-Identifier: Apache-2.0
import {Box, type BoxProps} from '@mui/material';

const listingPageSx = {
  mx: 'auto',
  width: '100%',
  height: '100%',
  px: 2,
  pt: 3,
} as const;

/**
 * Full-width listing page shell used by offline maps and map-layer screens.
 */
export function ListingPage({sx, children, ...props}: BoxProps) {
  return (
    <Box sx={[listingPageSx, ...(Array.isArray(sx) ? sx : [sx])]} {...props}>
      {children}
    </Box>
  );
}
