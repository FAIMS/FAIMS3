import OAuth2Strategy from 'passport-oauth2';
import {AuthInfo} from './datamodel/database';

export const auth_mechanisms: {
  [auth_id: string]: {
    public: AuthInfo;
    strategy: OAuth2Strategy.StrategyOptions;
  };
} = {
  default: {
    // Should be in sync with clients
    public: {
      portal: 'http://127.0.0.1:8080',
      type: 'oauth',
      name: 'Data Central',
    },
    // Not visible to clients
    strategy: {
      authorizationURL:
        'https://auth.datacentral.org.au/cas/oauth2.0/authorize',
      tokenURL: 'https://auth.datacentral.org.au/cas/oauth2.0/accessToken',
      clientID: '5c1dca8c5c10f7b96f50e5829816a260-datacentral.org.au',
      clientSecret:
        '3478721c4c92e9e6118aaa315712854087ebc4b01abb9e7977bd17dc66d0c67c',
      callbackURL: 'http://localhost:8080/auth-return/',
    },
  },
};
