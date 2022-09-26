import React from 'react';
import {
  Box,
  Link,
  Typography,
  Breadcrumbs as MuiBreadcrumbs,
} from '@mui/material';
import {Link as RouterLink} from 'react-router-dom';

import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
type BreadcrumbProps = {
  data: Array<{title: string; link?: string}>;
};
export default function Breadcrumbs(props: BreadcrumbProps) {
  const {data} = props;
  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));
  return (
    <Box display="flex" flexDirection="row-reverse" sx={{p: 1, m: 1}}>
      <MuiBreadcrumbs
        aria-label="breadcrumb"
        maxItems={not_xs ? 4 : 2}
        itemsAfterCollapse={2}
        itemsBeforeCollapse={0}
      >
        {data.map(item => {
          return item.link !== undefined ? (
            <Link
              component={RouterLink}
              to={item.link}
              underline={'none'}
              key={'breadcrumb-item-' + item.title}
            >
              {item.title}
            </Link>
          ) : (
            <Typography
              color="textPrimary"
              key={'breadcrumb-item-' + item.title}
            >
              {item.title}
            </Typography>
          );
        })}
      </MuiBreadcrumbs>
    </Box>
  );
}
