import {Typography} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import Obfuscate from 'react-obfuscate';
import {COMMIT_VERSION, CONDUCTOR_URLS} from '../../../buildconfig';
import {useAppSelector} from '../../../context/store';
import {selectActiveUser} from '../../../context/slices/authSlice';

interface SupportEmailProps {}

export default function SupportEmail(props: SupportEmailProps) {
  const theme = useTheme();
  // Get active user
  const activeUser = useAppSelector(selectActiveUser);

  let supportEmail = 'support@fieldmark.au';
  if (
    import.meta.env.VITE_COMMIT_VERSION !== undefined &&
    import.meta.env.VITE_COMMIT_VERSION.includes('psmip')
  ) {
    supportEmail = 'support@fieldmark.au';
  }
  const bodyContent =
    `Server: ${CONDUCTOR_URLS.join(', ')} \r` +
    `Commit Version: ${COMMIT_VERSION} \r` +
    `Username: ${activeUser?.username ?? 'Unauthenticated'} \r` +
    `Roles: ${
      activeUser?.parsedToken.roles
        ? JSON.stringify(activeUser?.parsedToken.roles)
        : 'Unauthenticated'
    }`;

  return (
    <Typography variant="subtitle2" color={theme.palette.grey[900]}>
      Support:{' '}
      <Obfuscate
        className={'support-link'}
        email={supportEmail}
        headers={{
          subject: 'Fieldmark Support',
          body: bodyContent,
        }}
      />
    </Typography>
  );
}
