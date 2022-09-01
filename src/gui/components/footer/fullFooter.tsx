import {useTheme} from '@mui/material/styles';
import React from 'react';
import {Box, Divider, Grid, Typography} from '@mui/material';
import Link from '@mui/material/Link';
import SlimFooter from './slimFooter';
import SupportEmail from './supportEmail';
import {TokenContents} from '../../../datamodel/core';
interface FullFooterProps {
  token?: null | undefined | TokenContents;
}
export default function FullFooter(props: FullFooterProps) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        backgroundColor: theme.palette.grey[200],
        padding: theme.spacing(2),
        marginTop: theme.spacing(1),
      }}
    >
      <Grid container spacing={2}>
        <Grid item xs={12} sx={{display: {xs: 'block', sm: 'none'}}}>
          <SlimFooter token={props.token} />
        </Grid>
        <Grid item sm={4} sx={{display: {xs: 'none', sm: 'block'}}}>
          <Box>
            <img
              src="/static/logo/Faims-small.png"
              style={{
                maxWidth: '180px',
                width: '100%',
                filter: 'grayscale(100%)',
                opacity: 0.8,
                marginBottom: '20px',
              }}
            />
            <Typography variant="caption" display="block" gutterBottom>
              Copyright © FAIMS {new Date().getFullYear()}
            </Typography>
          </Box>
        </Grid>
        <Grid item sm={4} sx={{display: {xs: 'none', sm: 'block'}}}>
          <Typography
            variant="overline"
            display="block"
            gutterBottom
            sx={{color: theme.palette.grey[600]}}
          >
            About
          </Typography>
          <Typography variant={'caption'}>
            FAIMS provides tools for the collection of born-digital field data
            through to archiving for any research discipline, workflow,
            ontology, and standard.
          </Typography>
          <br />
          <Typography
            variant="overline"
            display="block"
            gutterBottom
            sx={{color: theme.palette.grey[600], mt: 1}}
          >
            Support
          </Typography>
          <SupportEmail />
          <Typography variant={'caption'}>
            <Link
              href="https://faims.edu.au/contact/"
              underline="none"
              target={'_blank'}
              rel="noreferrer"
              sx={{color: theme.palette.text.primary}}
            >
              Contact
            </Link>
            <br />
            <Link
              href="https://faims.edu.au/privacy"
              underline="none"
              target={'_blank'}
              rel="noreferrer"
              sx={{color: theme.palette.text.primary}}
            >
              Privacy Policy
            </Link>
            <br />
            <Link
              href="https://faims.edu.au/licenses/"
              underline="none"
              target={'_blank'}
              rel="noreferrer"
              sx={{color: theme.palette.text.primary}}
            >
              Licenses
            </Link>
            <br />
          </Typography>
        </Grid>
        <Grid item sm={4} sx={{display: {xs: 'none', sm: 'block'}}}>
          <Typography
            variant="overline"
            display="block"
            gutterBottom
            sx={{color: theme.palette.grey[600]}}
          >
            Partner Organisations
          </Typography>
          <Box>
            <img
              src={'/static/logo/partners/ARDC_logo_RGB.png'}
              alt={'ardc logo'}
              style={{
                maxWidth: '150px',
                width: '100%',
                filter: 'grayscale(100%)',
              }}
            />
            <br />
            <Typography variant={'caption'}>
              The FAIMS 3.0 Electronic Field Notebooks project received
              investment (doi: 10.47486/PL110) from the Australian Research Data
              Commons (ARDC). The ARDC is funded by the National Collaborative
              Research Infrastructure Strategy (NCRIS).
            </Typography>
          </Box>
          <Divider sx={{my: 1}} />
          <Box>
            <Grid container justifyContent={'center'} alignItems="center">
              <Grid
                item
                xs={12}
                sm={12}
                md={12}
                lg={4}
                style={{textAlign: 'center'}}
              >
                <img
                  src={'/static/logo/partners/CSIRO_Solid_RGB.png'}
                  alt={'csiro logo'}
                  style={{
                    maxWidth: '60px',
                    width: '100%',
                    filter: 'grayscale(100%)',
                    opacity: 0.8,
                  }}
                />
              </Grid>
              <Grid
                item
                xs={12}
                sm={12}
                md={12}
                lg={8}
                style={{textAlign: 'center'}}
              >
                <img
                  src={'/static/logo/partners/MQ_MAS_HOR_BLACK.png'}
                  alt={'macquarie university logo'}
                  style={{
                    maxWidth: '200px',
                    width: '100%',
                    filter: 'grayscale(100%)',
                    opacity: 0.8,
                  }}
                />
              </Grid>
            </Grid>
          </Box>
          <Divider />
          <Link
            href={
              process.env.REACT_APP_PARTNERS_HREF ??
              'https://faims.edu.au/partners/'
            }
            variant="caption"
            target="_blank"
            rel="noreferrer"
            sx={{textDecoration: 'none', color: theme.palette.grey[700]}}
          >
            All FAIMS partners
          </Link>
        </Grid>
      </Grid>
    </Box>
  );
}
