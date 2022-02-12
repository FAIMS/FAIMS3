import React from 'react';
import {
  Box,
  Link,
  Typography,
  Breadcrumbs as MuiBreadcrumbs,
  Grid,
} from '@material-ui/core';
import {Link as RouterLink} from 'react-router-dom';

import {useTheme} from '@material-ui/core/styles';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import {TokenContents} from '../../../datamodel/core';
type BreadcrumbProps = {
  data: Array<{title: string; link?: string}>;
  token?: null | undefined | TokenContents;
};
export default function Breadcrumbs(props: BreadcrumbProps) {
  const {data, token} = props;
  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));
  return (
    <Grid container spacing={1}>
      <Grid item xs={12} sm={2} lg={2}>
        <Box
          display="flex"
          flexDirection="row"
          pt={1}
          pl={2}
          pb={1}
          mt={1}
          ml={1}
          mb={1}
        >
          {token !== null && token !== undefined && (
            <Typography>{token.username}</Typography>
          )}
        </Box>
      </Grid>
      <Grid item xs={12} sm={10} lg={10}>
        <Box
          display="flex"
          flexDirection="row-reverse"
          pt={1}
          pl={2}
          pb={1}
          mt={1}
          ml={1}
          mb={1}
        >
          <MuiBreadcrumbs aria-label="breadcrumb" maxItems={not_xs ? 4 : 2}>
            {data.map(item => {
              return item.link !== undefined ? (
                <Link
                  component={RouterLink}
                  to={item.link}
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
      </Grid>
    </Grid>
  );
}
