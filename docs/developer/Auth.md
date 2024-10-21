# Authorisation system documentation

This documentation should be considered a WIP.

## Refresh token functionality

Refresh tokens are an addition to the standard token based auth system which the app uses to prove user identity for the logged in user.

The overall workflow of refresh tokens is

- when user logs in (using credentials / identity provider) they are provided both a signed **access** token, and a unique **refresh** token
- the access token acts as authorisation up to it's expiry date (**noting that this is not yet implemented - TODO**)
- prior to, or even after, the expiry of the user's current access token, they may gain a new access token with a refreshed expiry by presenting the refresh token
- once the refresh token expires, the user must re-login with their original credentials

### What is a refresh token?

A refresh token is a unique random UUID string which authorises the user to exchange said token for current access token JWTs up to the expiry of the refresh token.

A refresh token is an opaque unique ID which corresponds to a database document which describes the authority of the token. The schema of the document is defined in [data model](../../library/data-model/src/data_storage/authDB/document.ts) e.g.

```typescript
export interface RefreshRecordFields {
  // Mandatory field for auth records
  documentType: 'refresh';

  // Which user ID has this refresh token
  userId: string;

  // What is the token?
  token: string;

  // When does it expire? unix timestamp in ms
  expiryTimestampMs: number;

  // Is this token valid
  enabled: boolean;
}
```

### How are they created?

These tokens are created by generating an opaque unique ID, then lodging a document into the `auth` DB.

These tokens will not be generated unless the user has provided original credentials, and cannot be extended.

The method which generates these tokens is [shown below](../../api/src/couchdb/refreshTokens.ts)

```typescript
/**
 * Creates a new refresh token for a given user.
 * @param userId The ID of the user for whom the token is being created.
 * @returns A Promise that resolves to the newly created AuthRecord.
 */
export const createNewRefreshToken = async (
  userId: string,
  expiryMs: number = TOKEN_EXPIRY_MS
): Promise<AuthRecord> => {
  const authDB = getAuthDB();

  // Generate a new UUID for the token
  const token = uuidv4();
  const dbId = AuthRecordIdPrefixMap.get('refresh') + uuidv4();

  // Set expiry to configured duration
  const expiryTimestampMs = generateExpiryTimestamp(expiryMs);

  const newRefreshToken: RefreshRecordFields = {
    documentType: 'refresh',
    userId,
    token,
    expiryTimestampMs,
    enabled: true,
  };

  // Create a new document in the database
  const response = await authDB.put({_id: dbId, ...newRefreshToken});

  // Fetch the created document to return the full AuthRecord
  return await authDB.get(response.id);
};
```

### How are they stored and accessed?

Refresh tokens are stored in a database called `auth` which, while containing an indexing and ID prefixing structure which allows for multiple document types, currently contains only refresh tokens.

This database is initialised alongside other initialisation methods in the [initialisation code](../../api/src/couchdb/initialise.ts). Notably, we inject a permission document, some views/indexes and set the security settings

```typescript
try {
  await db.security(AuthDatabaseSecurityDocument).save();
} catch (e) {
  console.error('Failed to save security document into Auth DB. Error: ' + e);
  throw e;
}

// Next setup the permissions document - overwrite if existing
try {
  await safeWriteDocument(db, permissionDocument);
} catch (e) {
  console.error(
    'Failed to upsert permission document into Auth DB. Error: ' + e
  );
  throw e;
}

// Next setup the index document - overwrite if existing
try {
  await safeWriteDocument(db, viewsDocument);
} catch (e) {
  console.error('Failed to upsert index document into Auth DB. Error: ' + e);
  throw e;
}
```

These documents are defined in [data model](../../library/data-model/src/data_storage/authDB). Notably, view map methods are implemented in native JS and then compiled into a string and injected into the DB, which provides an advantage over plain strings due to the availability of linting, IDE syntax highlighting etc.

**Note**: If these documents change, the initialisation method will not apply the updates due to the existence of prior records. To update documents, this could be done by

- manually updating the documents in the couch DB interface or,
- deleting the records temporarily and then running the init method or,
- changing the code locally to ignore this check, then running the init (noting this may not work for the public keys depending on your deployment configuration).

The API exposes a set of CRUD methods which interact with these tokens, including the following methods

- `createNewRefreshToken`: Creates a new refresh token for a user
- `validateRefreshToken`: Validates a refresh token and fetches associated user
- `getTokensByUserId`: Retrieves all refresh tokens for a given user
- `invalidateToken`: Invalidates an existing token by setting it as disabled
- `getTokenByToken`: Retrieves a refresh token document by its token value
- `getTokenByTokenId`: Retrieves a refresh token document by its document ID
- `getAllTokens`: Retrieves all refresh tokens in the database
- `deleteRefreshToken`: Deletes a refresh token based on specified index and identifier

The query methods leverage Couch's map function based indexing system which interacts with the design documents to expose particular views such as 'by token', 'by id' or 'by user'.

### Refresh token endpoint

A user can provide a valid refresh token, and then receive a new access token (which will be short lived once the expiry is re-instantiated).

Validity is defined as

- a refresh token is provided
- the refresh token exists in the database
- the refresh token must not be expired
- the refresh token was not marked as invalid through the enabled field being false
- if the user provides authorisation which links to a user ID, and the refresh token was not minted for that user, it is not valid (note this is just a best effort as the user could simply remove the token and then re-request to gain access)

### Security implications

Refresh tokens are temporary secrets which provide the user relatively long-lived access to resources. However, the alternatives are not ideal.

- long lived JWTs: JWT access tokens are stateless so cannot be revoked or revised, this represents a significant security risk since there can, in some cases, be literally no way to revoke a leaked JWT, especially in a microservices architecture where services trust signed JWTs for their marked duration, irrespective of the authorisation server's opinion on the matter. Long lived JWTs also become stale where the user authorisation (e.g. roles) are embedded into the token - this might necessitate the user to log back in after operations which change user roles.
- short lived JWTs: these are more secure since the risk is reduced by their short life (e.g. 5 minutes), however, this means the user must constantly log back in to the application by providing their source credentials, they also still cannot be revoked. Short lived JWTs also become stale, as above, though the risk is lower.
- session / refresh tokens only: if we removed the concept of JWTs, and had server side validated tokens only, then all services which depend on the authorisation of a token must contact the server to validate the user's authorisation. This has the advantage of the authorisation always being up to date, but has significant downsides
  - the service may not be capable of performing this operation such as in embedded DB operations in couch DB
  - this introduces a lot of network calls for mostly stale information
  - security implications of having a potentially long lived token transmitted frequently to and between services
  - offline application usage would be complicated by the need to cache the authorisation response from the server so that the application can selectively render components of the system the user is authorised to see

The combination of short lived access tokens + long lived refresh tokens is a nice solution for the following reasons

- user access tokens are less likely to become stale, and can be easily programmatically refreshed without any user interaction, in addition - we can enforce that the token is refreshed at least once per X minutes by configuring it's expiry
- if a JWT is leaked, it has a much shorter expiry so the implications of this are reduced
- the user has the perception of remaining 'logged in' for a longer period without needing to enter new credentials
- stateful refresh tokens can be revoked, or reconfigured without any input from the client
- long lived credentials do not have to be transmitted as frequently over the network, and typically not between services, only to and from the authorisation service

**Note**: currently, the handlebars application relies on a cookie based session for managing authentication through passport- moving forward, we should unify to using a single session management approach - this limits the entry vectors into the system and means less code to maintain. When conductor is migrated to a `react` SPA, we can update the authorisation approach since there will be no need for HTML templated routes.

### When are refresh tokens created?

Currently, refresh tokens are generated when a user is redirected with auth

TODO: understand the entrypoints in the system where users have provided 'source credentials' be that through username/password or identity provider redirect, in order to limit the generation of refresh tokens.

```typescript
/**
 * Generate a redirect response with a token and refresh token for a logged in
 * user
 *
 * TODO restrict the generation of refresh tokens to initial login
 * @param res Express response
 * @param user Express user
 * @param redirect URL to redirect to
 * @returns a redirect response with a suitable token
 */
const redirect_with_token = async (
  res: Response,
  user: Express.User,
  redirect: string
) => {
  // there is a case where the redirect url will already
  // have a token (register >> login >>  register)
  if (redirect.indexOf('?token=') >= 0) {
    return res.redirect(redirect);
  }

  // Generate a token (include refresh)
  const token = await generateUserToken(user, true);

  // Append the token to the redirect URL
  const redirectUrlWithToken = `${redirect}?token=${token.token}&refreshToken=${token.refreshToken}`;

  // Redirect to the app with the token
  return res.redirect(redirectUrlWithToken);
};
```

This is returned as a query string and then parsed by the front end in the Auth Return component.

### How are refresh tokens used in the FAIMS3 app?

The FAIMS3 application has a local pouch DB which stores the following [data structure](../../app/src/sync/databases.ts):

```typescript
/**
 * Login tokens for each FAIMS Cluster that needs it
 */
export type JWTToken = string;

export interface JWTTokenInfo {
  token: JWTToken;
  // Might have a refresh token we can use to get a new token
  refreshToken?: JWTToken;
  parsedToken: TokenContents;
}

export type JWTTokenMap = {[k: string]: JWTTokenInfo};

export interface LocalAuthDoc {
  _id: string; // Corresponds to a listings ID
  _rev?: string; // optional as we may want to include the raw json in places
  current_username: string;
  // Map from username -> TokenContents - this is serialised as a JS object but
  // interacted with through ObjectMap
  available_tokens: JWTTokenMap;
}
```

Note that there is an entry for `LocalAuthDoc` for each listing.

TODO: understand which token is 'relevant'/'active' at a given time for the user - currently the first listing is used as a default to render protected routes, for example.

This database is initialised on application startup, then kept synchronised through the [auth return](../../app/src/gui/components/authentication/auth_return.tsx) component, which retrieves the token(s) from the query strings provided in the URL, then redirects the user.

The refresh endpoint is used, on demand, when the user creates a new survey - this ensures the new token has the required roles to allow the user to see and interact with this new survey.

## TODOs

- reinstantiate access token expiry, validate in all services using it
- setup front-end to fully utilise the refresh token workflow with automatic refreshing without user intervention (before token expires with buffer)
- consolidate session management to use access/refresh tokens instead of cookie sessions once conductor moves to react.
