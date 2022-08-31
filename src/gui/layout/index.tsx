import React from 'react';
import {Box} from '@mui/material';
import Navbar from './navbar';
import {TokenContents} from '../../datamodel/core';
import Footer from '../components/footer';
import {tokenExists} from '../../utils/helpers';

interface MainLayoutProps {
  children: React.ReactNode;
  token?: null | undefined | TokenContents;
}

const MainLayout = (props: MainLayoutProps) => {
  const isAuthenticated = tokenExists(props.token);
  return (
    <React.Fragment>
      <Navbar token={props.token} />
      <Box component="main" sx={{width: '100%', flexGrow: 1, p: 1}}>
        {/*<Breadcrumbs*/}
        {/*  navigation={navigation}*/}
        {/*  title*/}
        {/*  titleBottom*/}
        {/*  card={false}*/}
        {/*  divider={false}*/}
        {/*/>*/}

        {props.children}
      </Box>
      <Footer isAuthenticated={isAuthenticated} />
    </React.Fragment>
  );
};

export default MainLayout;
