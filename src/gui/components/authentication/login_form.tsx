import React, {useRef, useState} from 'react';
import {
  Box,
  Button,
  FormControl,
  Input,
  InputLabel,
  Tab,
  Tabs,
} from '@material-ui/core';
import {makeStyles} from '@material-ui/core/styles';
import {LocalAuthDoc} from '../../../datamodel';
import {local_auth_db} from '../../../sync/databases';

export type LoginFormProps = {
  listing_id: string;
  auth_doc?: LocalAuthDoc;
};

export type PasswordFormProps = {
  listing_id: string;
  auth_method: string;
};

const useStyles = makeStyles(theme => ({
  control_margin: {},
  panel_margin: {
    'margin-left': theme.spacing(2),
    'margin-right': theme.spacing(2),
  },
  root: {
    minWidth: '0px',
    flexGrow: 1,
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
  },
  tabs: {
    borderRight: `1px solid ${theme.palette.divider}`,
  },
}));

function PasswordForm(props: PasswordFormProps) {
  const classes = useStyles();
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  return (
    <React.Fragment>
      <FormControl className={classes.control_margin} fullWidth>
        <InputLabel htmlFor={`${props.auth_method}-username`}>
          Username
        </InputLabel>
        <Input
          inputRef={usernameRef}
          id={`${props.auth_method}-username`}
          fullWidth
        />
      </FormControl>
      <FormControl className={classes.control_margin} fullWidth>
        <InputLabel htmlFor={`${props.auth_method}-password`}>
          Password
        </InputLabel>
        <Input
          inputRef={passwordRef}
          type="password"
          id={`${props.auth_method}-password`}
          fullWidth
        />
      </FormControl>
      <Button
        className={classes.control_margin}
        variant="contained"
        color="primary"
        fullWidth
        onClick={async () => {
          const put_doc = {
            _id: props.listing_id,
            _rev: undefined as undefined | string,
            dc_token: passwordRef.current!.value,
          };
          try {
            put_doc._rev = (await local_auth_db.get(props.auth_method))._rev;
          } catch (err) {
            if (
              !('reason' in err) ||
              (err as {reason: string}).reason !== 'missing'
            ) {
              throw err;
            }
          }
          local_auth_db.put(put_doc);
        }}
      >
        Login
      </Button>
    </React.Fragment>
  );
}

export function LoginForm(props: LoginFormProps) {
  const classes = useStyles();
  const selectableAuthModes = [
    {id: 'dc_password', label: 'Data Central'},
    {id: 'other', label: 'Other'},
  ];
  const [selectedAuth, setSelectedAuth] = useState(0);

  return (
    <div className={classes.root}>
      <Tabs
        orientation="vertical"
        variant="scrollable"
        value={selectedAuth}
        onChange={(event, newIndex) => {
          setSelectedAuth(newIndex);
        }}
        aria-label="Vertical tabs example"
        className={classes.tabs}
      >
        {selectableAuthModes.map((mode, index) => (
          <Tab
            key={mode.id}
            label={mode.label}
            id={`vertical-tab-${index}`}
            aria-controls={`vertical-tabpanel-${index}`}
          />
        ))}
      </Tabs>
      {selectableAuthModes.map((mode, index) => (
        <Box
          className={classes.panel_margin}
          role="tabpanel"
          hidden={index !== selectedAuth}
          id={`vertical-tabpanel-${index}`}
          aria-labelledby={`vertical-tab-${index}`}
        >
          {index === selectedAuth &&
            /* This is temporarily a other/dc password switch until
              alternative Authentication methods are implemented */
            (mode.id === 'dc_password' ? (
              <React.Fragment>
                <PasswordForm
                  listing_id={props.listing_id}
                  auth_method={selectableAuthModes[selectedAuth].id}
                />
              </React.Fragment>
            ) : (
              <React.Fragment>Unimplemented</React.Fragment>
            ))}
        </Box>
      ))}
    </div>
  );
}
