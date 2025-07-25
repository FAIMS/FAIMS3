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

Social providers are defined in `buildconfig.ts` as `CONDUCTOR_AUTH_PROVIDERS`. Auth providers should be referenced via their ID in the `AUTH_PROVIDER_DETAILS` map in `applyStrategies.ts`. A semicolon separated list is used.

## Key Files

- `authPages.ts`: Defines handlebars pages for login and registration pages
- `authRoutes.ts`: Defines API routes for authentication endpoints
- `strategies/applyStrategies.ts`: Configures Passport.js strategies
- `strategies/localStrategy.ts`: Local authentication strategy
- `strategies/googleStrategy.ts`: Google OAuth strategy
- `helpers.ts`: Utility functions for authentication

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

            alt Has inviteId
                Server->>CouchDB: validateAndApplyInviteToUser()
                CouchDB-->>Server: Updated user
                Server->>CouchDB: saveExpressUser()
            end

            Server->>Server: Generate exchange token via redirectWithToken()
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
                    Server->>CouchDB: validateAndApplyInviteToUser()
                    CouchDB-->>Server: Updated user
                    Server->>CouchDB: saveExpressUser()
                    Server->>Server: Generate exchange token
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
                Server->>CouchDB: validateAndApplyInviteToUser() with createUser function
                CouchDB-->>Server: Created user with invite applied
                Server->>Server: Generate exchange token
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

    Server->>Server: Store auth context in session
    Note over Server: session.redirect = redirect
    Note over Server: session.inviteId = inviteId
    Note over Server: session.action = "login"

    Server->>Passport: authenticate('google')
    Passport->>Google: Redirect to Google OAuth
    Google->>User: Display Google login page
    User->>Google: Authenticate with Google
    Google->>Browser: Redirect to callback URL with auth code

    Browser->>Server: GET /auth-return/google
    Server->>Passport: authenticate('google')
    Passport->>Google: Exchange auth code for tokens
    Google-->>Passport: Return tokens and profile

    Passport->>CouchDB: Check for matching email in users
    CouchDB-->>Passport: Return matching user(s) or null

    alt No matching emails
        Passport-->>Server: Return error (no account exists)
        Server->>Browser: Flash error, redirect to login page
    else One matching email
        Passport->>CouchDB: Ensure Google profile is linked to user
        CouchDB-->>Passport: Updated user
        Passport-->>Server: Return user

        alt Has inviteId in session
            Server->>CouchDB: validateAndApplyInviteToUser()
            CouchDB-->>Server: Updated user
            Server->>CouchDB: saveCouchUser()
        end

        Server->>Server: Generate exchange token
        Server->>Browser: Redirect to session.redirect?exchangeToken=TOKEN&serverId=ID

        Browser->>Server: POST /api/auth/exchange
        Note over Browser,Server: Body: {exchangeToken: TOKEN}

        Server->>CouchDB: consumeExchangeTokenForRefreshToken()
        CouchDB-->>Server: {valid: true, user, refreshDocument}

        Server->>Server: Generate JWT token
        Server-->>Browser: Return {accessToken: JWT, refreshToken: REFRESH}
    else Multiple matching emails
        Passport-->>Server: Return error (ambiguous match)
        Server->>Browser: Flash error, redirect to login page
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

    Server->>Server: Store auth context in session
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

    alt No inviteId in session
        Passport-->>Server: Return error (no invite for registration)
        Server->>Browser: Flash error, redirect to /register
    else Has inviteId
        Passport->>CouchDB: lookupAndValidateInvite()

        alt Invalid invite
            CouchDB-->>Passport: Invalid invite
            Passport-->>Server: Return error
            Server->>Browser: Flash error, redirect to /register
        else Valid invite
            CouchDB-->>Passport: Valid invite
            Passport->>CouchDB: Check for matching email in users
            CouchDB-->>Passport: Return matching user(s) or null

            alt No matching emails
                Passport->>CouchDB: Create new user with Google profile
                Passport->>CouchDB: Add all verified emails to user
                CouchDB-->>Passport: Return new user
                Passport-->>Server: Return user

                Server->>CouchDB: validateAndApplyInviteToUser()
                CouchDB-->>Server: Updated user
                Server->>CouchDB: saveCouchUser()
                Server->>Server: Generate exchange token
                Server->>Browser: Redirect to session.redirect?exchangeToken=TOKEN&serverId=ID

                Browser->>Server: POST /api/auth/exchange
                Note over Browser,Server: Body: {exchangeToken: TOKEN}

                Server->>CouchDB: consumeExchangeTokenForRefreshToken()
                CouchDB-->>Server: {valid: true, user, refreshDocument}

                Server->>Server: Generate JWT token
                Server-->>Browser: Return {accessToken: JWT, refreshToken: REFRESH}
            else One matching email
                Passport->>CouchDB: Ensure Google profile is linked to user
                CouchDB-->>Passport: Updated user
                Passport-->>Server: Return user

                Server->>CouchDB: validateAndApplyInviteToUser()
                CouchDB-->>Server: Updated user
                Server->>CouchDB: saveCouchUser()
                Server->>Server: Generate exchange token
                Server->>Browser: Redirect to session.redirect?exchangeToken=TOKEN&serverId=ID

                Browser->>Server: POST /api/auth/exchange
                Note over Browser,Server: Body: {exchangeToken: TOKEN}

                Server->>CouchDB: consumeExchangeTokenForRefreshToken()
                CouchDB-->>Server: {valid: true, user, refreshDocument}

                Server->>Server: Generate JWT token
                Server-->>Browser: Return {accessToken: JWT, refreshToken: REFRESH}
            else Multiple matching emails
                Passport-->>Server: Return error (ambiguous match)
                Server->>Browser: Flash error, redirect to /register
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

### Invite System

Invitations are used for registration and to grant access to resources:

1. Invites are validated with `isInviteValid()`
2. Applied to users with `validateAndApplyInviteToUser()`
3. Consumed with `consumeInvite()`

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
