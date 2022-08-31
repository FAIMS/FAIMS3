import React from 'react';
import {useMediaQuery, Container, Link, Typography, Stack} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import Obfuscate from 'react-obfuscate';

const SlimFooter = () => {
  /**
   * Slim footer with minimal necessary links to reduce user distraction
   * Switch the contact email based on REACT_APP_COMMIT_VERSION
   * Obfuscate email address
   */
  const theme = useTheme();
  const matchDownSM = useMediaQuery(theme.breakpoints.down('sm'));
  let supportEmail = 'info@faims.edu.au';
  if (
    process.env.REACT_APP_COMMIT_VERSION !== undefined &&
    process.env.REACT_APP_COMMIT_VERSION.includes('psmip')
  ) {
    supportEmail = 'psmipsupport@faims.edu.au';
  }

  return (
    <React.Fragment>
      <Container maxWidth="xl" sx={{p: 2}}>
        <Stack
          direction={matchDownSM ? 'column' : 'row'}
          justifyContent={matchDownSM ? 'center' : 'space-between'}
          spacing={2}
          textAlign={matchDownSM ? 'center' : 'inherit'}
        >
          <Typography variant="subtitle2" color="secondary" component="span">
            &copy; FAIMS {new Date().getFullYear()}&nbsp;
          </Typography>

          <Stack
            direction={matchDownSM ? 'column' : 'row'}
            spacing={matchDownSM ? 1 : 3}
            textAlign={matchDownSM ? 'center' : 'inherit'}
          >
            <Typography
              variant="subtitle2"
              color="secondary"
              component={Link}
              href="https://faims.edu.au/privacy"
              target="_blank"
              underline="none"
            >
              Privacy Policy
            </Typography>
            <Typography variant="subtitle2" color="secondary">
              <Obfuscate
                element={Link}
                underline="none"
                color="secondary"
                email={supportEmail}
              >
                Support
              </Obfuscate>
            </Typography>
            <Typography
              variant="subtitle2"
              color="secondary"
              component={Link}
              href="https://faims.edu.au/contact/"
              target="_blank"
              underline="none"
            >
              Contact
            </Typography>
          </Stack>
        </Stack>
      </Container>
    </React.Fragment>
  );
};

export default SlimFooter;
