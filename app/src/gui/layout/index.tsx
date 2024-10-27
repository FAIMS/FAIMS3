import {Box} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import React from 'react';
import {ErrorBoundary, ErrorPage} from '../../logging';
import {PossibleToken} from '../../types/misc';
import Footer from '../components/footer';
import MainAppBar from './appBar';
import {useGetDefaultToken} from '../../utils/tokenHooks';

interface MainLayoutProps {
  children: React.ReactNode;
  token?: PossibleToken;
}

const MainLayout = (props: MainLayoutProps) => {
  const tokenQuery = useGetDefaultToken();
  const token = tokenQuery.data?.parsedToken;
  const theme = useTheme();
  const appbarHeight = 64;
  const minHeightMob = 128 + appbarHeight; // min height of footer in mobile mode + appbar height
  const minHeightDesktop = 35 + appbarHeight; // min height of footer in desktop mode + appbar height

  return (
    <React.Fragment>
      <MainAppBar token={token} />
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
        {/*<Breadcrumbs*/}
        {/*  navigation={navigation}*/}
        {/*  title*/}
        {/*  titleBottom*/}
        {/*  card={false}*/}
        {/*  divider={false}*/}
        {/*/>*/}

        <ErrorBoundary FallbackComponent={ErrorPage}>
          {props.children}
        </ErrorBoundary>
      </Box>
      <Footer token={token} />
    </React.Fragment>
  );
};

export default MainLayout;
