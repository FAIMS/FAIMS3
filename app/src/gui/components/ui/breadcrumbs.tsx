import React from 'react';
import {
  Box,
  Typography,
  Breadcrumbs as MuiBreadcrumbs,
  IconButton,
  Button,
} from '@mui/material';
import {Link as RouterLink, useNavigate} from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

type BreadcrumbProps = {
  data: Array<{title: string; link?: string}>;
  backLink?: string;
};

export default function Breadcrumbs(props: BreadcrumbProps) {
  const {data, backLink} = props;
  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));
  const navigate = useNavigate();
  const isMobile = !useMediaQuery(theme.breakpoints.up('sm'));

  // Function to abbreviate long titles on small screens
  const abbreviateTitle = (title: string) => {
    if (title.length > 10 && !not_xs) {
      return title.substring(0, 7) + '...';
    }
    return title;
  };

  return (
    <Box display="flex" flexDirection="row-reverse" sx={{p: 1, m: 1}}>
      {/* Show "Back to Responses" button only on mobile */}
      {isMobile && backLink && (
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(backLink)}
          variant="text"
          sx={{
            fontSize: '0.875rem',
            textTransform: 'none',
            color: theme.palette.primary.main,
          }}
        >
          Back to Responses
        </Button>
      )}

      {/* Hide breadcrumbs in mobile view */}
      {!isMobile && (
        <MuiBreadcrumbs
          aria-label="breadcrumb"
          maxItems={not_xs ? 4 : 2}
          itemsAfterCollapse={not_xs ? 2 : 1}
          itemsBeforeCollapse={not_xs ? 0 : 1}
        >
          {data.map((item, index) => {
            // If it's the root item, use an icon
            if (index === 0 && item.link) {
              return (
                <RouterLink
                  to={item.link}
                  key={'breadcrumb-item-' + item.title}
                >
                  <IconButton size="small">
                    <HomeIcon fontSize="inherit" />
                  </IconButton>
                </RouterLink>
              );
            }
            return item.link !== undefined ? (
              <RouterLink to={item.link} key={'breadcrumb-item-' + item.title}>
                {abbreviateTitle(item.title)}
              </RouterLink>
            ) : (
              <Typography
                color="textPrimary"
                key={'breadcrumb-item-' + item.title}
              >
                {abbreviateTitle(item.title)}
              </Typography>
            );
          })}
        </MuiBreadcrumbs>
      )}
    </Box>
  );
}
