# Long-Lived API Tokens

## Overview

Long-lived API tokens provide a secure way to authenticate with the system APIs programmatically. Unlike user sessions, these tokens can be configured with custom expiry dates and are designed for automated scripts, CI/CD pipelines, and other programmatic access scenarios.

## Why can't I use the token directly?

The token cannot be immediately used to authenticate to the system APIs. Instead, you need to exchange it for a short-lived access token.

The reason for this extra step is that long-lived tokens are a serious security risk. This is particularly so if they are routinely used in regular API calls. If the token is used directly, a single compromised API call could result in an attacker gaining long-term access to your account. By ensuring the token is exchanged for an access token, if a regular API token is leaked, it will only last for 5 minutes.

## Responsibility and Security

It is the responsibility of the user to ensure their token is managed securely, this means:

- don't share it with anyone
- don't store it anywhere in plain text: use a password manager or encrypted secrets management service to store/retrieve it
- don't put the token into code in plain text
- ensure the token is not built/embedded into build artifacts such as Docker images - use runtime environment variables instead

The token can be revoked, but does grant full access to your account via the system API. If you think your token has been compromised

- immediately revoke the token using the management panel in the web interface
- immediately update your password
- immediately contact a system administrator to notify them of the suspected breach

## How It Works

### Two-Step Authentication Process

1. **Create Long-Lived Token**: Generate a long-lived token via the web interface
2. **Exchange for Access Token**: Use the long-lived token to obtain short-lived access tokens programmatically
3. **Use Access Token**: Make API calls with the short-lived access token
4. **Refresh as Needed**: Exchange the long-lived token for new access tokens when they expire

### Token Exchange Workflow

```
Long-Lived Token → Exchange API → Short-Lived Access Token → API Calls
     (days/months)                    (minutes)
```

## Getting Started

### 1. Create a Long-Lived Token

1. Navigate to **Manage API Tokens** in the web interface (Profile icon in lower left -> Profile -> Long-Lived API Tokens)
2. Click **Create Long-Lived Token**
3. Provide a title and description
4. Set an expiry date (or none if your deployment allows it)
5. **Important**: Copy and securely store the token immediately - it won't be shown again - you can create another token if needed

### 2. Exchange for Access Token

**Endpoint**: `POST /api/auth/exchange-long-lived-token`

**Request**:

```json
{
  "token": "your-long-lived-token-here"
}
```

**Response**:

```json
{
  "token": "short-lived-access-token"
}
```

### 3. Use Access Token

Include the access token in your API requests:

```
Authorization: Bearer <access_token>
```

## Implementation Examples

### TypeScript/JavaScript

```typescript
class APIClient {
  private longLivedToken: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private baseURL: string;

  constructor(longLivedToken: string, baseURL: string) {
    this.longLivedToken = longLivedToken;
    this.baseURL = baseURL;
  }

  async exchangeToken(): Promise<string> {
    const response = await fetch(
      `${this.baseURL}/api/auth/exchange-long-lived-token`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({token: this.longLivedToken}),
      }
    );

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.token;
    // NOTE: This assumes a 5 minute expiry (refreshing 1 minute early), you could use the 'exp' field of the JWT to determine this
    this.tokenExpiry = Date.now() + 4 * 60 * 1000;

    return this.accessToken;
  }

  async getValidAccessToken(): Promise<string> {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.exchangeToken();
    }
    return this.accessToken!;
  }

  async apiCall(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await this.getValidAccessToken();

    return fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  }
}

// Usage
const client = new APIClient(
  // You should pass this in from the environment or other secure source
  'your-long-lived-token',
  'https://api.example.com'
);
const response = await client.apiCall('/api/some-endpoint');
```

### Python

```python
import requests
import time
from typing import Optional

class APIClient:
    def __init__(self, long_lived_token: str, base_url: str):
        self.long_lived_token = long_lived_token
        self.base_url = base_url.rstrip('/')
        self.access_token: Optional[str] = None
        self.token_expiry: float = 0

    def exchange_token(self) -> str:
        """Exchange long-lived token for access token."""
        response = requests.post(
            f"{self.base_url}/api/auth/exchange-long-lived-token",
            json={"token": self.long_lived_token}
        )
        response.raise_for_status()

        data = response.json()
        self.access_token = data["token"]
        # Assume 5-minute expiry, refresh 1 minute early
        self.token_expiry = time.time() + (4 * 60)

        return self.access_token

    def get_valid_access_token(self) -> str:
        """Get a valid access token, refreshing if necessary."""
        if not self.access_token or time.time() >= self.token_expiry:
            self.exchange_token()
        return self.access_token

    def api_call(self, endpoint: str, method: str = "GET", **kwargs) -> requests.Response:
        """Make an authenticated API call."""
        token = self.get_valid_access_token()

        headers = kwargs.pop('headers', {})
        headers['Authorization'] = f'Bearer {token}'

        return requests.request(
            method=method,
            url=f"{self.base_url}{endpoint}",
            headers=headers,
            **kwargs
        )

# Usage
client = APIClient('your-long-lived-token', 'https://api.example.com')
response = client.api_call('/api/some-endpoint')
```
