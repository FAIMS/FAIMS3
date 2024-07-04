import React from 'react';
import {Box} from '@mui/material';
import AppBar from './appBar';
import {TokenContents} from 'faims3-datamodel';
import Footer from '../components/footer';
import {useTheme} from '@mui/material/styles';
import {ErrorBoundary, ErrorPage} from '../../logging';

interface MainLayoutProps {
  children: React.ReactNode;
  token?: null | undefined | TokenContents;
}

const MainLayout = (props: MainLayoutProps) => {
  const theme = useTheme();
  const appbarHeight = 64;
  const minHeightMob = 128 + appbarHeight; // min height of footer in mobile mode + appbar height
  const minHeightDesktop = 35 + appbarHeight; // min height of footer in desktop mode + appbar height

  return (
    <React.Fragment>
      <AppBar token={props.token} />
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
      <Footer token={props.token} />
    </React.Fragment>
  );
};

export default MainLayout;
