/**
 * @file Shared right-column layout for designer fuzzy-search dropdown rows.
 */

import {Box, Typography} from '@mui/material';
import type {ReactNode} from 'react';
import {designerSearchMatchHighlightSx} from '../../components/designer-style';

export type SearchResultContentProps = {
  title: ReactNode;
  detail?: ReactNode | null;
  location?: ReactNode | null;
};

/** Title + optional detail and location lines used by global and field search dropdowns. */
export const SearchResultContent = ({
  title,
  detail,
  location,
}: SearchResultContentProps) => (
  <Box sx={{minWidth: 0, py: 0.25}}>
    <Typography
      variant="body2"
      component="div"
      sx={{fontWeight: 600, ...designerSearchMatchHighlightSx}}
    >
      {title}
    </Typography>
    {detail && (
      <Typography
        variant="caption"
        color="text.secondary"
        component="div"
        sx={{
          display: 'block',
          mt: 0.25,
          ...designerSearchMatchHighlightSx,
        }}
      >
        {detail}
      </Typography>
    )}
    {location && (
      <Typography
        variant="caption"
        color="text.secondary"
        component="div"
        sx={{
          display: 'block',
          mt: 0.25,
          fontStyle: 'italic',
          ...designerSearchMatchHighlightSx,
        }}
      >
        {location}
      </Typography>
    )}
  </Box>
);
