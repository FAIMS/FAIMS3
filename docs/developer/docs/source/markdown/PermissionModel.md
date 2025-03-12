# Permission Model

## Definitions

### User

The person or entity interacting with the system, attempting to perform 'actions' on 'resources'.

### Resource

A resource is an object/entity in the system which we want to protect. You require a 'permission', granted through your 'role' to take an 'action' on a 'resource'. E.g. `project`, `template`.

### Permission

A permission is a grant which provides the right for a user to undertake some action(s) on given resource(s). E.g. `write-project`.

### Role

A role is a label we grant to users which grants a set of permissions on a set of resources. E.g. `project-manager`.

### Action

An action is some task which a user wishes to undertake upon/involving some resource(s). E.g. `edit-project-specification`.

### Token

A token is a verifiable form of evidence presented by a user which proves that the user has certain permissions based on the user's roles.

## Permission system overview

Users are authorised to generate tokens which contain permissions. The system API knows everything about a user through the various system databases (e.g. their team membership, their relationship to various projects or templates), and generates on demand (when authenticated) a token which embeds all of the permissions that the user has at that time.

All other actors in the system then trust this token to provide evidence of user permissions.

When a user tries to take an action upon a resource, the permission model will perform the following check:

> Does the user have in their token a permission upon the targeted resource which authorises the requested action?

This will be checked through a centralised, configurable and complete permission model in the `data-model`.

This model is not replicated here, as it is best described/managed programmatically.

## Points of enforcement

The permission model needs to be enforced in these locations

### API

The system API needs to ensure that actions taken on resources are authorised. This is easy to achieve in the API as this is an always online service which has complete access to all resources relating to a user's permissions (e.g. databases, permission models) etc. The API also has the important responsibility of dispatching tokens which embed permissions on resources.

### CouchDB

The Couch DB needs to ensure that read/writes to the database(s) are authorised. This is achieved by looking only at **permissions** that the token includes. CouchDB has a primitive security model which only allows the following control points

1. The database has a security document which determines which roles must be present on a token in order to grant either a) member or b) admin access to a database. Member access = read, write and delete all documents. Admin access = everything.
2. `validate_doc_update` - this is a special method which can be embedded as a javascript function into the database which provides a runtime check of user's permissions before writing a document update. This allows fine grained document level control over **write operations**.

The overall approach for managing database permissions will be

1. For **all** system databases, only allow the `_admin` role to be a member or admin - this means only the API can interact with these databases at all
2. For **data** databases, only allow the `_admin` role to be admin, and allow **any read or write related permission for that project** to be a member
3. Restrict with `validate_doc_update` any write operations by checking that the user has the required write permission
4. Make use of replication filters to minimise data being made available where our permission model dictates it _shouldn't_ be, while acknowledging that a malicious actor can bypass this client side good behaviour by relying on other methods such as all doc or get requests.

#### Notable limitation

CouchDB cannot enforce per-document level read access checks, only write. There is no `validate_doc_read` - **any user with member access to the database can always fundamentally read any document in that database**. The only option we have to bypass this system limitation is to a) produce an intermediary service between the client and Couch or b) block certain routes/requests through some proxy service before it reaches Couch to only allow access to whitelisted sync points.

### Frontend clients

Front-end clients will optimistically enforce the permission model, not so much as a security measure, but as a UX measure, to ensure that actions are not presented on resources for which the frontend theoretically knows in advance will result in authorisation errors. For example, a 'create new project' button should not be presented unless the permission model dictates that the user can perform that action on the resource.

## Relevant source code references

TODO.
