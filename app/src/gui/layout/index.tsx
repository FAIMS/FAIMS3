import React from 'react';
import {Box} from '@mui/material';
import MainAppBar from './appBar';
import {TokenContents} from '@faims3/data-model';
import Footer from '../components/footer';
import {useTheme} from '@mui/material/styles';
import {ErrorBoundary, ErrorPage} from '../../logging';
import TransparentButton from '../components/buttons/transparent-button';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import {useNavigate, useLocation} from 'react-router-dom';
import Breadcrumbs from '../components/ui/breadcrumbs';

const hideBackButtonPaths = ['/', '/signin/'];

interface MainLayoutProps {
  children: React.ReactNode;
  token?: null | undefined | TokenContents;
}

/**
 * MainLayout component that structures the main layout of the application, including the app bar,
 * breadcrumbs, navigation, and footer.
 *
 * @param {MainLayoutProps} props - The properties passed to the component.
 * @param {React.ReactNode} props.children - The child components or content to be rendered within the layout.
 * @param {string} props.token - The token for authentication or other use cases passed to AppBar and Footer.
 * @returns {JSX.Element} - The rendered MainLayout component.
 */
export default function MainLayout(props: MainLayoutProps): JSX.Element {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const navigation = import.meta.env.VITE_NAVIGATION;

  const appbarHeight = 64;
  const minHeightMob = 128 + appbarHeight; // Minimum height of footer in mobile mode + app bar height
  const minHeightDesktop = 35 + appbarHeight; // Minimum height of footer in desktop mode + app bar height

  return (
    <React.Fragment>
      <MainAppBar token={props.token} />
      <Box
        component="main"
        sx={{
          width: '100%',
          flexGrow: 1,
          p: {xs: theme.spacing(1), sm: theme.spacing(2), md: theme.spacing(3)},
          minHeight: {
            xs: 'calc(100vh - ' + minHeightMob + 'px)',
            sm: 'calc(100vh - ' + minHeightDesktop + 'px)',
          },
        }}
      >
        {navigation === 'breadcrumbs' && (
          <Breadcrumbs path={location.pathname} />
        )}
        {navigation === 'back-button' &&
          !hideBackButtonPaths.includes(location.pathname) && (
            <TransparentButton
              onClick={() =>
                navigate(
                  // Workaround for a bug causing multiple navigations when creating drafts
                  location.pathname.includes('/draft/') ? -3 : -1
                )
              }
              style={{
                fontSize: '16px',
                paddingBottom: '16px',
              }}
            >
              <ChevronLeft />
              {'Back'}
            </TransparentButton>
          )}
        <ErrorBoundary FallbackComponent={ErrorPage}>
          {props.children}
        </ErrorBoundary>
      </Box>
      <Footer token={props.token} />
    </React.Fragment>
  );
}
