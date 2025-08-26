# Authentication

You can register an account with the {{FAIMS}} system either through a email and password or
using a federated authentication service such as Google or a configured SSO provider.
In each case, {{FAIMS}} creates a system account record for you with minimal personal details
(your name and email address).   These details are used only to identify you as the owner
of teams, notebooks and records that you create in the app.

## Email Verification

When you register an account, the system will send a confirmation email to your
configured email address. This will allow you to verify this address with the system
so that we know that it is legitimate.  Un-verified accounts are still valid and can
use the system, however we may place restrictions on the actions that you can carry
out in future.

If you don't get the original email, you will see a banner when you login to the
{{dashboard}} that will allow you to re-send the verification email.

## Refreshing Login

You will be prompted to refresh your login in the mobile app from time to time, the
frequency depends on the configuration but defaults to every two days. This ensures
that your device is still being used by you and provides some assurance about data
safety and provenance.

## Working Offline

If you are offline for longer than two days, you won't be able to refresh your login
and you will see a banner in the app asking you to do so.  You can continue working
and collecting data while offline.  When you re-connect to the network, you will be
able to refresh your login and this will allow your collected records to be saved
to the server.

## API Access Tokens

If you are using an integration with {{FAIMS}} that makes use of the API, or if you
are writing your own scripts, you will need to create a _Long-Lived API Token_.
You can do this via the {{dashboard}} as follows:

1. Navigate to **Manage API Tokens** in the {{dashboard}} (Profile icon in lower left -> Profile -> Long-Lived API Tokens)
2. Click **Create Long-Lived Token**
3. Provide a title and description
4. Set an expiry date (or none if your deployment allows it)
5. **Important**: Copy and securely store the token immediately - it won't be shown again - you can create another token if needed

### Responsibility and Security

It is the responsibility of the user to ensure their token is managed securely, this means:

- don't share it with anyone
- don't store it anywhere in plain text: use a password manager or encrypted secrets management service to store/retrieve it
- don't put the token into code in plain text
- ensure the token is not built/embedded into build artifacts such as Docker images - use runtime environment variables instead

The token can be revoked, but does grant full access to your account via the system API. If you think your token has been compromised

- immediately revoke the token using the management panel in the web interface
- immediately update your password
- immediately contact a system administrator to notify them of the suspected breach
