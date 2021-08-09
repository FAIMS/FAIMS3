import {
  Box,
  Button,
  FormControl,
  Input,
  InputLabel,
  MenuItem,
  Select,
} from '@material-ui/core';
import {makeStyles} from '@material-ui/core/styles';
import {LocalAuthDoc} from '../../../datamodel';

export type LoginFormProps = {
  auth_doc?: LocalAuthDoc;
};

const useStyles = makeStyles(theme => ({
  margin: {
    'margin-top': theme.spacing(2),
  },
}));

export function LoginForm(props: LoginFormProps) {
  const classes = useStyles();

  return (
    <Box>
      <FormControl className={classes.margin} fullWidth>
        <Select
          labelId="auth-method"
          id="auth-method"
          value={'dc_password'}
          fullWidth
        >
          <MenuItem value={'dc_password'}>Data Central</MenuItem>
        </Select>
      </FormControl>
      <FormControl className={classes.margin} fullWidth>
        <InputLabel htmlFor="dc-username">Username</InputLabel>
        <Input id="dc-username" fullWidth />
      </FormControl>
      <FormControl className={classes.margin} fullWidth>
        <InputLabel htmlFor="dc-password">Password</InputLabel>
        <Input type="password" id="dc-password" fullWidth />
      </FormControl>
      <Button
        className={classes.margin}
        variant="contained"
        color="primary"
        fullWidth
      >
        Login
      </Button>
    </Box>
  );
}
