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

## Exporting data with an API token

Export is two authenticated requests. Exchange your long-lived token for an access token first, then:

1. `GET /api/notebooks/{projectId}/records/export?format=csv&viewID=FORM` with `Authorization: Bearer <access_token>`
2. `GET` the `url` from the JSON response with the **same** `Authorization` header, and write the body to a file

The download URL is only an identifier. It does not work without your Bearer token (or, in the Control Centre, a short-lived cookie the browser sets automatically). Do not share the URL as if it were a password.

Mint and download share a dedicated export rate limit (default **20 requests per 10 minutes** per user or IP). A `429` means wait for the window to reset, or ask an administrator to raise `EXPORT_RATE_LIMITER_PER_WINDOW` for bulk dumps.

```
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$API/api/notebooks/$PROJECT/records/export?format=csv&viewID=FORM" \
  | jq -r .url > /tmp/dl.url

curl -sS -H "Authorization: Bearer $TOKEN" -o export.csv "$(cat /tmp/dl.url)"
```
