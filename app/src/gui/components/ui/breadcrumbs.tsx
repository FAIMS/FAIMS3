import {Box, Breadcrumbs as MuiBreadcrumbs, IconButton} from '@mui/material';
import {Link as RouterLink} from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {abbreviateTitle, removeListing} from '../../../lib/string';

interface BreadcrumbProps {
  path: string;
}

/**
 * Breadcrumbs component that displays the current path as navigational breadcrumbs.
 *
 * @param {BreadcrumbProps} props - The properties passed to the component.
 * @param {string} props.path - The path to display as breadcrumbs.
 * @returns {JSX.Element | null} - The rendered Breadcrumbs component or null if no path is provided.
 */
export default function Breadcrumbs({
  path,
}: BreadcrumbProps): JSX.Element | null {
  if (!path) return null;

  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));

  const pathSplit = path.split('/').filter((p: string) => p !== '');

  return (
    <Box display="flex" flexDirection="row-reverse">
      <MuiBreadcrumbs aria-label="breadcrumb">
        <RouterLink to="/" key={'breadcrumb-item-/'}>
          <IconButton size="small">
            <HomeIcon fontSize="inherit" />
          </IconButton>
        </RouterLink>
        {pathSplit.length > 2 && <div>{'...'}</div>}
        {pathSplit.length > 1 && (
          <div>
            {abbreviateTitle(removeListing(pathSplit.at(-2) || ''), not_xs)}
          </div>
        )}
        {pathSplit.length > 0 && (
          <div>
            {abbreviateTitle(removeListing(pathSplit.at(-1) || ''), not_xs)}
          </div>
        )}
      </MuiBreadcrumbs>
    </Box>
  );
}
