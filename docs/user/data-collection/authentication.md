# Authentication

You can register an account with the {{FAIMS}} system either through a email and password or using a federated authentication service such as Google or a configured SSO provider.

In each case, {{FAIMS}} creates a system account record for you with minimal personal details (your name and email address).   These details are used only to identify you as the owner of teams, notebooks and records that you create in the app.

## Email Verification

When you register an account, the system will send a confirmation email to your configured email address. This will allow you to verify this address with the system so that we know that it is legitimate.  Un-verified accounts are still valid and can use the system, however we may place restrictions on the actions that you can carry out in future.

If you don't get the original email, you will see a banner when you login to the {{dashboard}} that will allow you to re-send the verification email.

## Refreshing Login

You will be prompted to refresh your login in the mobile app from time to time, the frequency depends on the configuration but defaults to every two days. This ensures that your device is still being used by you and provides some assurance about data safety and provenance.

## Working Offline

If you are offline for longer than two days, you won't be able to refresh your login and you will see a banner in the app asking you to do so.  You can continue working and collecting data while offline.  When you re-connect to the network, you will be able to refresh your login and this will allow your collected records to be saved to the server.

## Integrations

To learn more about authentication for API Access, see [API Access Tokens](../data-export/api-tokens.md).
