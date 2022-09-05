import React from 'react';
import {Box} from '@mui/material';
import AppBar from './appBar';
import {TokenContents} from '../../datamodel/core';
import Footer from '../components/footer';
import {useTheme} from '@mui/material/styles';

interface MainLayoutProps {
  children: React.ReactNode;
  token?: null | undefined | TokenContents;
}

const MainLayout = (props: MainLayoutProps) => {
  const theme = useTheme();
  return (
    <React.Fragment>
      <AppBar token={props.token} />
      <Box
        component="main"
        sx={{
          width: '100%',
          flexGrow: 1,
          p: {xs: theme.spacing(1), sm: theme.spacing(2), md: theme.spacing(3)},
        }}
      >
        {/*<Breadcrumbs*/}
        {/*  navigation={navigation}*/}
        {/*  title*/}
        {/*  titleBottom*/}
        {/*  card={false}*/}
        {/*  divider={false}*/}
        {/*/>*/}

        {props.children}
      </Box>
      <Footer token={props.token} />
    </React.Fragment>
  );
};

export default MainLayout;
