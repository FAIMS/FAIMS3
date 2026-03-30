# Authentication System Documentation

This document explains the authentication system built with Passport.js for the FAIMS3 application. The system handles both local authentication (username/password) and federated authentication via social providers (e.g., Google).

## Overview

The authentication system consists of several components:

- Express routes for authentication pages and API endpoints
- Passport.js strategies for various authentication methods
- Session management for storing authentication state
- Token generation for authenticated users
- Token exchange for secure acquisition of access and refresh tokens

## Configuration

The system is configured in `expressSetup.ts` which initializes:

1. Passport.js with appropriate strategies via `applyPassportStrategies`
2. Authentication handlebar **pages** via `addAuthPages`
3. Authentication API **routes** via `addAuthRoutes`

Configuration settings allow enabling of either local email/password authentication or
one or more federated identity providers. There is a custom implementation for
Google authentication, a more general OIDC based provider and a custom SAML provider
implementation.  Further SSO protocols could be supported via their passport
implementations.

The available
providers are configured via environment variables using a pattern of variable
names to encode an object structure.  Variables starting with `AUTH_` define
the properties of different providers with the pattern `AUTH_{provider}_{property}`.   There are two kinds of provider: Google and OIDC.  These are configured
as follows:

For a Google provider, the TYPE property should be `google` and the following
properties should be supplied:

```shell
AUTH_GOOGLE_TYPE="google"
AUTH_GOOGLE_INDEX=1
AUTH_GOOGLE_DISPLAY_NAME="Google"
AUTH_GOOGLE_HELPER_TEXT="Log in with your Google account"
AUTH_GOOGLE_CLIENT_ID="google client id"
AUTH_GOOGLE_CLIENT_SECRET="google client secret"
AUTH_GOOGLE_SCOPE="profile,email,https://www.googleapis.com/auth/plus.login"
```

For an OIDC provider, the `TYPE` property should be `oidc` and the following
properties should be defined:

```shell
AUTH_AAF_TYPE="oidc"
AUTH_AAF_INDEX=2
AUTH_AAF_DISPLAY_NAME="AAF"
AUTH_AAF_HELPER_TEXT="Use your Australian University credentials"
AUTH_AAF_ISSUER="https://central.test.aaf.edu.au"
AUTH_AAF_AUTHORIZATION_URL="https://central.test.aaf.edu.au/oidc/authorize"
AUTH_AAF_TOKEN_URL="https://central.test.aaf.edu.au/oidc/token"
AUTH_AAF_USER_INFO_URL="https://central.test.aaf.edu.au/oidc/userinfo"
AUTH_AAF_CLIENT_ID="aaf client id"
AUTH_AAF_CLIENT_SECRET="aaf client secret"
AUTH_AAF_SCOPE="profile,email"
```

For a SAML provider there are more options.

```shell
# A SAML based provider example
AUTH_SAML_TYPE="saml"
AUTH_SAML_INDEX=3
AUTH_SAML_DISPLAY_NAME="Example SAML"
AUTH_SAML_HELPER_TEXT="Log in with your SAML account"
AUTH_SAML_SCOPE="profile,email"

# Required SAML settings
AUTH_SAML_ENTRY_POINT="https://example.authentication.gov/saml/authenticate"
AUTH_SAML_ISSUER="https://your-app.example.com"
AUTH_SAML_CALLBACK_URL="https://your-app.example.com/auth/saml/callback"

# SAML keys (PEM format - use \n for newlines in env vars)

# NOTE: recommended these should never be stored in plaintext in production
# environments - inject in on platform level using recommended secrets
# management approach. E.g. on AWS - use Secret env variables. 

# Private key: Your SP's private key for signing requests
AUTH_SAML_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nYourPrivateKeyHere\n-----END RSA PRIVATE KEY-----"
# Public key: The IdP's certificate for verifying signatures (from IdP metadata)
AUTH_SAML_PUBLIC_KEY="-----BEGIN CERTIFICATE-----\nIdPCertificateHere\n-----END CERTIFICATE-----"
# IDP Public key: The IdP's public key for encrypting assertions (from IdP metadata)
AUTH_SAML_IDP_PUBLIC_KEY=abcd1234
# Sign the SAML metadata document? Requires private key
AUTH_SAML_SIGN_METADATA=true

# Optional SAML settings
AUTH_SAML_SIGNATURE_ALGORITHM="sha256"
AUTH_SAML_WANT_ASSERTIONS_SIGNED="true"
AUTH_SAML_IDENTIFIER_FORMAT="urn:oasis:names:tc:SAML:2.0:nameid-format:persistent"

# Additional optional SAML settings (include as needed)
AUTH_SAML_ACCEPTED_CLOCK_SKEW_MS="0"
AUTH_SAML_MAX_ASSERTION_AGE_MS="3600000"
AUTH_SAML_VALIDATE_IN_RESPONSE_TO="true"
AUTH_SAML_REQUEST_ID_EXPIRATION_PERIOD_MS="28800000"
AUTH_SAML_FORCE_AUTHN="false"
AUTH_SAML_DISABLE_REQUESTED_AUTHN_CONTEXT="false"
AUTH_SAML_AUTHN_CONTEXT="urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport"
AUTH_SAML_LOGOUT_URL="https://thirdparty.authentication.business.gov.au/fas/v3.1/saml20/logout"
AUTH_SAML_LOGOUT_CALLBACK_URL="https://your-app.example.com/auth/saml/logout/callback"
AUTH_SAML_IDP_ISSUER="https://thirdparty.authentication.business.gov.au"
AUTH_SAML_AUDIENCE="https://your-app.example.com"
```

Note that another provider of the same type can be configured, eg. you
could configure `AUTH_FOOBAR_TYPE="oidc"` and supply the other `AUTH_FOOBAR_*`
properties as well.

The `DISPLAY_NAME` field is used to label the login button _"Continue with XXX"_.
The `HELPER_TEXT` field is optional and is displayed below the login button
if provided. The `INDEX` field is optional but if present, defines the ordering
of buttons on the login page.

## Key Files

- `authPages.ts`: Defines handlebars pages for login and registration pages
- `authRoutes.ts`: Defines API routes for authentication endpoints
- `strategies/applyStrategies.ts`: Configures Passport.js strategies
- `strategies/localStrategy.ts`: Local authentication strategy
- `strategies/googleStrategy.ts`: Google OAuth strategy
- `helpers.ts`: Utility functions for authentication including `completePostAuth` (shared post-authentication handler for all flows) and `ssoVerify` (Passport verify callback for all SSO strategies)

## Token Exchange System

The authentication system uses a secure token exchange flow to prevent token leakage:

1. After successful authentication, the server generates an **exchange token**
2. The exchange token is delivered to the client via a redirect URL parameter
3. The client then makes a secure API call to exchange this token for:
   - An access token (JWT)
   - A refresh token

This approach improves security by:

- Preventing long-lived tokens from appearing in browser history or logs
- Ensuring the exchange token can only be used once
- Storing exchange tokens as hashes in the database to protect against data breaches

### Exchange Token Flow

```mermaid
sequenceDiagram
    participant Client
    participant Server
    participant CouchDB

    Note over Client,Server: Authentication successful
    Server->>Client: Redirect with exchangeToken & serverId
    Client->>Server: POST /api/auth/exchange {exchangeToken}
    Server->>CouchDB: consumeExchangeTokenForRefreshToken()
    CouchDB->>Server: {valid: true, user, refreshDocument}
    Server->>Client: {accessToken, refreshToken}
```

## Authentication Flows

### Local Authentication - Login Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Server
    participant Passport
    participant CouchDB

    User->>Browser: Navigate to /login?redirect=URL&inviteId=CODE
    Browser->>Server: GET /login
    Server->>Browser: Render login page with providers and query params

    User->>Browser: Enter credentials & submit
    Browser->>Server: POST /auth/local
    Note over Browser,Server: Body: {email, password, action: "login", redirect, inviteId}

    Server->>Passport: authenticate('local')
    Passport->>CouchDB: Get user by email/username
    CouchDB-->>Passport: Return user or null

    alt User found
        Passport->>Passport: Verify password hash
        alt Valid password
            Passport-->>Server: Return user

            Server->>Server: completePostAuth(dbUser, action="login", inviteId?)
            Note over Server: If inviteId present: validateAndApplyInviteToUser() + saveCouchUser()<br/>On invite failure: soft warning only — login is not blocked<br/>Clears session.inviteId and session.action<br/>upgradeCouchUserToExpressUser() + redirectWithToken()
            Server-->>Browser: Redirect to redirect_url?exchangeToken=TOKEN&serverId=ID

            Browser->>Server: POST /api/auth/exchange
            Note over Browser,Server: Body: {exchangeToken: TOKEN}

            Server->>CouchDB: consumeExchangeTokenForRefreshToken()
            CouchDB-->>Server: {valid: true, user, refreshDocument}

            Server->>Server: Generate JWT token
            Server-->>Browser: Return {accessToken: JWT, refreshToken: REFRESH}
        else Invalid password
            Passport-->>Server: Return error
            Server->>Browser: Flash error and redirect to /login with query params
        end
    else User not found
        Passport-->>Server: Return error
        Server->>Browser: Flash error and redirect to /login with query params
    end
```

### Local Authentication - Registration Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Server
    participant Passport
    participant CouchDB

    User->>Browser: Navigate to /register?redirect=URL&inviteId=CODE
    Browser->>Server: GET /register
    Server->>CouchDB: getInvite() and isInviteValid()

    alt Invalid invite
        CouchDB-->>Server: Invalid invite
        Server->>Browser: Render invite-error page
    else Valid invite
        CouchDB-->>Server: Valid invite
        Server->>Browser: Render registration page with providers

        User->>Browser: Enter details & submit
        Browser->>Server: POST /auth/local
        Note over Browser,Server: Body: {email, name, password, repeat, action: "register", redirect, inviteId}

        Server->>Server: Validate input with PostRegisterInputSchema

        alt Validation error
            Server->>Browser: Flash errors, redirect to /register with query params
        else Validation successful
            Server->>CouchDB: Check if user exists via getCouchUserFromEmailOrUsername()

            alt User exists
                Server->>Passport: authenticate('local')
                Passport->>CouchDB: Verify credentials
                CouchDB-->>Passport: Return user or error

                alt Authentication successful
                    Passport-->>Server: Return user
                    Server->>Server: completePostAuth(dbUser, action="register", inviteId)
                    Note over Server: validateAndApplyInviteToUser() + saveCouchUser()<br/>Hard error if invite invalid (flash + redirect to /register)<br/>Clears session.inviteId and session.action<br/>upgradeCouchUserToExpressUser() + redirectWithToken()
                    Server->>Browser: Redirect to redirect_url?exchangeToken=TOKEN&serverId=ID

                    Browser->>Server: POST /api/auth/exchange
                    Note over Browser,Server: Body: {exchangeToken: TOKEN}

                    Server->>CouchDB: consumeExchangeTokenForRefreshToken()
                    CouchDB-->>Server: {valid: true, user, refreshDocument}

                    Server->>Server: Generate JWT token
                    Server-->>Browser: Return {accessToken: JWT, refreshToken: REFRESH}
                else Authentication failed
                    Passport-->>Server: Return error
                    Server->>Browser: Flash error and redirect to /register with query params
                end
            else User doesn't exist
                Note over Server: completePostAuth is NOT used here — user creation is deferred<br/>via a createUser closure to avoid phantom accounts if the invite is invalid
                Server->>CouchDB: validateAndApplyInviteToUser(createUser, inviteCode)
                CouchDB-->>Server: Created and saved user with invite applied
                Server->>Server: upgradeCouchUserToExpressUser() + redirectWithToken()
                Server->>Browser: Redirect to redirect_url?exchangeToken=TOKEN&serverId=ID

                Browser->>Server: POST /api/auth/exchange
                Note over Browser,Server: Body: {exchangeToken: TOKEN}

                Server->>CouchDB: consumeExchangeTokenForRefreshToken()
                CouchDB-->>Server: {valid: true, user, refreshDocument}

                Server->>Server: Generate JWT token
                Server-->>Browser: Return {accessToken: JWT, refreshToken: REFRESH}
            end
        end
    end
```

### Google/Social Authentication - Login Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Server
    participant Passport
    participant Google
    participant CouchDB

    User->>Browser: Click Google login on /login page
    Browser->>Server: GET /auth/google?action=login&redirect=URL&inviteId=CODE

    Server->>Server: Write auth context to session (unconditional — clears stale values from prior flows)
    Note over Server: session.redirect = redirect
    Note over Server: session.inviteId = inviteId (or undefined if absent)
    Note over Server: session.action = "login"
    Note over Server: All three fields written unconditionally. A stale inviteId from a<br/>prior registration would otherwise persist in the 1-year cookie.

    Server->>Passport: authenticate('google')
    Passport->>Google: Redirect to Google OAuth
    Google->>User: Display Google login page
    User->>Google: Authenticate with Google
    Google->>Browser: Redirect to callback URL with auth code

    Browser->>Server: GET /auth-return/google
    Server->>Passport: authenticate('google')
    Passport->>Google: Exchange auth code for tokens
    Google-->>Passport: Return tokens and profile

    Note over Passport,CouchDB: ssoVerify — identity resolution only, no invite handling
    Passport->>CouchDB: Check for matching email in users
    CouchDB-->>Passport: Return matching user(s) or null

    alt Multiple matching emails
        Passport-->>Server: done(error — ambiguous match)
        Server->>Browser: Flash error, redirect to login page
    else No matching emails and no SSO provision policy configured
        Passport-->>Server: done(error — no account found)
        Server->>Browser: Flash error, redirect to login page
    else User resolved (one match, or new user created via SSO provision policy)
        Passport->>CouchDB: Ensure/create user and link SSO profile
        CouchDB-->>Passport: User saved
        Passport-->>Server: done(null, dbUser)

        Server->>Server: completePostAuth(dbUser, action="login", session.inviteId)
        Note over Server: If session.inviteId present: validateAndApplyInviteToUser() + saveCouchUser()<br/>On invite failure: soft warning only — login is not blocked<br/>Clears session.inviteId and session.action<br/>upgradeCouchUserToExpressUser() + redirectWithToken()
        Server-->>Browser: Redirect to session.redirect?exchangeToken=TOKEN&serverId=ID

        Browser->>Server: POST /api/auth/exchange
        Note over Browser,Server: Body: {exchangeToken: TOKEN}

        Server->>CouchDB: consumeExchangeTokenForRefreshToken()
        CouchDB-->>Server: {valid: true, user, refreshDocument}

        Server->>Server: Generate JWT token
        Server-->>Browser: Return {accessToken: JWT, refreshToken: REFRESH}
    end
```

### Google/Social Authentication - Registration Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Server
    participant Passport
    participant Google
    participant CouchDB

    User->>Browser: Click Google signup on /register page
    Browser->>Server: GET /auth/google?action=register&redirect=URL&inviteId=CODE

    alt No inviteId provided
        Server->>Browser: Flash error, redirect to /register immediately
        Note over Server,Browser: Registration without an invite is rejected before the SSO<br/>round-trip to avoid a confusing post-authentication failure
    else Has inviteId
        Server->>Server: Write auth context to session (unconditional — clears stale values from prior flows)
        Note over Server: session.redirect = redirect
        Note over Server: session.inviteId = inviteId
        Note over Server: session.action = "register"

        Server->>Passport: authenticate('google')
        Passport->>Google: Redirect to Google OAuth
        Google->>User: Display Google login page
        User->>Google: Authenticate with Google
        Google->>Browser: Redirect to callback URL with auth code

        Browser->>Server: GET /auth-return/google
        Server->>Passport: authenticate('google')
        Passport->>Google: Exchange auth code for tokens
        Google-->>Passport: Return tokens and profile

        Note over Passport,CouchDB: ssoVerify — identity resolution only, no invite validation
        Passport->>CouchDB: Check for matching email in users
        CouchDB-->>Passport: Return matching user(s) or null

        alt Multiple matching emails
            Passport-->>Server: done(error — ambiguous match)
            Server->>Browser: Flash error, redirect to /register
        else User resolved (one match or new user)
            Passport->>CouchDB: Find or create user and link SSO profile
            CouchDB-->>Passport: User saved
            Passport-->>Server: done(null, dbUser)

            Server->>Server: completePostAuth(dbUser, action="register", session.inviteId)
            alt Invite invalid or already consumed
                Server->>Browser: Flash error, redirect to /register (hard error — registration blocked)
            else Invite valid
                Note over Server: validateAndApplyInviteToUser() + saveCouchUser()<br/>Clears session.inviteId and session.action<br/>upgradeCouchUserToExpressUser() + redirectWithToken()
                Server-->>Browser: Redirect to session.redirect?exchangeToken=TOKEN&serverId=ID

                Browser->>Server: POST /api/auth/exchange
                Note over Browser,Server: Body: {exchangeToken: TOKEN}

                Server->>CouchDB: consumeExchangeTokenForRefreshToken()
                CouchDB-->>Server: {valid: true, user, refreshDocument}

                Server->>Server: Generate JWT token
                Server-->>Browser: Return {accessToken: JWT, refreshToken: REFRESH}
            end
        end
    end
```

## Key Components

### Authentication Context

The authentication context is passed between routes using query parameters and session storage:

```typescript
// AuthContext contains:
{
  redirect?: string; // Where to redirect after authentication
  inviteId?: string; // Optional invitation code
  action: 'login' | 'register'; // What action to perform
}
```

### `completePostAuth`

`completePostAuth` is a shared post-authentication helper used by the local login handler, local register Branch A (existing user), and all SSO callback handlers. It centralises the steps that are common to all successful authentication flows:

1. **Registration without invite** — returns a 400 response with a flash error and redirects to `errorRedirect`. Login without an invite continues normally.
2. **Invite application** (if `inviteId` present) — calls `validateAndApplyInviteToUser()` and `saveCouchUser()`.
   - For `register`: invite failure is a **hard error** — flash error + redirect to `errorRedirect`.
   - For `login`: invite failure is a **soft warning** — logged, flashed, but authentication continues.
3. **Session cleanup** — deletes `session.inviteId` and `session.action` to prevent stale values bleeding into future auth flows.
4. **Token generation** — calls `upgradeCouchUserToExpressUser()` then `redirectWithToken()`.

### `ssoVerify`

`ssoVerify` is the Passport verify callback registered for all SSO strategies (Google, OIDC, SAML). Its sole responsibility is **identity resolution**: finding or creating a `PeopleDBDocument` for the authenticated SSO user and returning it via `done(null, dbUser)`.

Key characteristics:

- Returns a raw `PeopleDBDocument` via `done()`, not an `Express.User`. The upgrade to `Express.User` (adding `resourceRoles`) happens later inside `completePostAuth`.
- **No invite handling** — invite validation and application are deliberately excluded and centralised in `completePostAuth`. This keeps `ssoVerify` focused and independently testable.
- Contains a **defence-in-depth guard**: if `action === 'register' && !inviteId`, it returns `done(error)` as a safeguard below the route-level guard that checks this first.

Login path: `identifyUser()` to find matching email(s) → if found, ensure SSO profile is linked; if not found, apply SSO provision policy (create account if configured, otherwise error).

Register path: find or create user by email → link SSO profile → `addEmails()` → `saveCouchUser()`.

### User Provisioning Policy

Based on the configuration setting `PROVISION_SSO_USERS_POLICY` the system can be configured to provision a new
user account when an unknown user logs in via SSO.  This capability is not available via local login as account
creation would be needed first.  It is intended for use in an enterprise environment where all valid users should
be able to make use of the system.

`PROVISION_SSO_USERS_POLICY` can have three possible values:

- `reject` will reject an unknown user and is the default
- `general-user` will create a new user account and give them the `GENERAL_USER` role
- `own-team` will create a new team and give the user the `TEAM_MANAGER` for that team

New policy could be implemented by updating `applyProvisionPolicy` in `helpers.ts`.

### Invite System

Invitations are used for registration and optionally for login:

- **Register**: an invite is **mandatory**. A missing or invalid invite causes a hard error — the user is redirected back to `/register` and authentication does not complete.
- **Login**: an invite is **optional**. If present, it is applied as an additional resource grant. On failure (e.g. already consumed, not found) a warning is logged and flashed, but the user is **not blocked** from logging in.

Invite lifecycle (handled inside `completePostAuth` for login, register Branch A, and all SSO flows):

1. Validated with `isInviteValid()`
2. Applied to users with `validateAndApplyInviteToUser()`
3. Consumed internally by `validateAndApplyInviteToUser()`

For local register Branch B (new user), invite validation uses a deferred `createUser` closure passed directly to `validateAndApplyInviteToUser()` to avoid creating phantom accounts if the invite turns out to be invalid.

### Token Generation and Exchange

After successful authentication, a token exchange flow is implemented:

1. `createNewRefreshToken()` creates a refresh token with an exchange token
2. `redirectWithToken()` redirects to the client app with the exchange token
3. Client calls `/api/auth/exchange` with the exchange token
4. `consumeExchangeTokenForRefreshToken()` validates and consumes the exchange token
5. Server returns both access token (JWT) and refresh token

The exchange token workflow provides enhanced security:

- Exchange tokens are single-use only (`exchangeTokenUsed: true` after use)
- Exchange tokens are stored as hashes in the database (`exchangeTokenHash`)
- Exchange tokens have the same expiry as the refresh token they're associated with

### Refresh Token Flow

After initial authentication, refresh tokens can be used to obtain new access tokens:

1. Client calls `/api/auth/refresh` with the refresh token
2. Server validates the refresh token and returns a new access token

## URL Validation

The system protects against open redirect vulnerabilities:

1. `validateRedirect()` checks that redirect URLs match whitelist
2. Default redirect URL is used when validation fails

## Error Handling

Errors are handled consistently throughout the authentication flow:

1. Input validation errors are mapped with `handleZodErrors()`
2. Authentication errors are flashed back to the user
3. Security errors return minimal information to prevent information leakage

## Adding a New Provider

To add a new authentication provider:

1. Create a new strategy in `strategies/`
2. Add the provider to `AUTH_PROVIDER_DETAILS` in `applyStrategies.ts`
3. Add the provider to `CONDUCTOR_AUTH_PROVIDERS` in `buildconfig.ts`

## Development Notes

- Local authentication always stores passwords using PBKDF2 with a per-user salt
- Social providers store profile information in `user.profiles[provider]`
- Multiple emails can be associated with a single user account
- The system enforces unique email addresses across all users
- Exchange tokens are one-time use and stored as hashes for security
- SSO session fields (`inviteId`, `action`, `redirect`) are written unconditionally on every auth initiation. This prevents stale values from a prior auth flow (e.g. a completed registration's `inviteId`) bleeding into a new one. Cookie session max age is now one day so this is less of a concern than it was when we used one year.
