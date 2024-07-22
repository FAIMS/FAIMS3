import {useTheme} from '@mui/material/styles';
import React from 'react';
import {Box, Divider, Grid, Typography} from '@mui/material';
import Link from '@mui/material/Link';
import SlimFooter from './slimFooter';
import SupportEmail from './supportEmail';
import {TokenContents} from 'faims3-datamodel';

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
        <Grid
          item
          sm={4}
          md={4}
          lg={3}
          sx={{display: {xs: 'none', sm: 'block'}, mt: 1}}
        >
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
              Electronic Field Notebooks publishes this app under an Apache 2.0
              open source license. Researcher data copyright belongs to the
              researchers.
            </Typography>
          </Box>
        </Grid>
        <Grid
          item
          sm={5}
          md={5}
          lg={3}
          sx={{display: {xs: 'none', sm: 'block'}, mt: 1}}
        >
          <Typography
            variant="overline"
            display="block"
            gutterBottom
            sx={{color: theme.palette.grey[600]}}
          >
            About
          </Typography>
          <Typography variant={'caption'}>
            Fieldmark™ is an open-source tool for born-digital field data
            collection brought to you by the FAIMS Project
          </Typography>
        </Grid>
        <Grid
          item
          sm={3}
          md={3}
          lg={3}
          sx={{display: {xs: 'none', sm: 'block'}, mt: 1}}
        >
          <Typography
            variant="overline"
            display="block"
            gutterBottom
            sx={{color: theme.palette.grey[600]}}
          >
            Support
          </Typography>
          <SupportEmail />
          <Typography variant={'caption'}>
            <Link
              href="https://fieldnote.au/contact/"
              underline="none"
              target={'_blank'}
              rel="noreferrer"
              sx={{color: theme.palette.text.primary}}
            >
              Contact
            </Link>
            <br />
            <Link
              href="https://fieldnote.au/privacy"
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
        <Grid
          item
          sm={12}
          md={12}
          lg={3}
          sx={{display: {xs: 'none', sm: 'block'}, mt: 1}}
        >
          <Typography
            variant="overline"
            display="block"
            gutterBottom
            sx={{color: theme.palette.grey[600]}}
          >
            Partner Organisations
          </Typography>
          <Grid container spacing={2}>
            <Grid item>
              <img
                src={'/static/logo/partners/ARDC_logo_RGB.png'}
                alt={'ardc logo'}
                style={{
                  maxWidth: '150px',
                  width: '100%',
                  marginTop: '10px',
                }}
              />
            </Grid>
            <Grid item sm={8} lg={12}>
              <Typography variant={'caption'}>
                The FAIMS 3.0 Electronic Field Notebooks project received
                investment (doi: 10.47486/PL110) from the Australian Research
                Data Commons (ARDC). The ARDC is funded by the National
                Collaborative Research Infrastructure Strategy (NCRIS).
              </Typography>
            </Grid>
          </Grid>
          <Divider sx={{my: 1}} />
          <Box>
            <Grid container>
              <Grid item style={{textAlign: 'left'}}>
                <img
                  src={'/static/logo/partners/MQ_INT_HOR_RGB_POS.png'}
                  alt={'macquarie university logo'}
                  style={{
                    maxWidth: '200px',
                    width: '100%',
                  }}
                />
              </Grid>
              <Grid item style={{textAlign: 'left'}}>
                <img
                  src={'/static/logo/partners/CSIRO_Solid_RGB.png'}
                  alt={'csiro logo'}
                  style={{
                    maxWidth: '80px',
                    width: '100%',
                    opacity: 0.8,
                    paddingLeft: theme.spacing(2),
                    paddingTop: theme.spacing(1),
                  }}
                />
              </Grid>
            </Grid>
            <Box sx={{textAlign: 'right'}}>
              <Link
                href={
                  import.meta.env.VITE_PARTNERS_HREF ??
                  'https://faims.edu.au/partners/'
                }
                variant="caption"
                target="_blank"
                rel="noreferrer"
                sx={{textDecoration: 'none', color: theme.palette.text.primary}}
              >
                All FAIMS partners
              </Link>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
