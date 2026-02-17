# API Access Tokens

If you are using an integration with {{FAIMS}} that makes use of the API, or if you are writing your own scripts, you will need to create a _Long-Lived API Token_.

You can do this via the {{dashboard}} as follows:

1. Navigate to **Manage API Tokens** in the {{dashboard}} (Profile icon in lower left -> Profile -> Long-Lived API Tokens)
2. Click **Create Long-Lived Token**
3. Provide a title and description
4. Set an expiry date (or none if your deployment allows it)
5. **Important**: Copy and securely store the token immediately - it won't be shown again - you can create another token if needed

## Responsibility and Security

It is the responsibility of the **user** to ensure their token is managed securely, this means:

- don't share it with anyone
- don't store it anywhere in plain text: use a password manager or encrypted secrets management service to store/retrieve it
- don't put the token into code in plain text
- ensure the token is not built/embedded into build artifacts such as Docker images - use runtime environment variables instead

The token can be revoked, but does grant full access to your account via the system API. If you think your token has been compromised

- immediately revoke the token using the management panel in the web interface
- immediately update your password
- immediately contact a system administrator to notify them of the suspected breach
