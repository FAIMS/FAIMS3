// SPDX-License-Identifier: Apache-2.0
import {Box, Stack, Typography, type BoxProps} from '@mui/material';
import type {ReactNode} from 'react';
import BackButton from './BackButton';

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

/** Centered title with a back control, and an optional trailing action. */
export function ListingPageHeader({
  backLink,
  title,
  end,
}: {
  backLink: string;
  title: string;
  end?: ReactNode;
}) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{justifyContent: 'space-between', alignItems: 'center'}}
    >
      <BackButton link={backLink} />
      <Typography variant="h4" sx={{flex: 1, minWidth: 0, textAlign: 'center'}}>
        {title}
      </Typography>
      {end}
    </Stack>
  );
}
