# FAIMS3 API

[![codecov](https://codecov.io/gh/FAIMS/FAIMS3-conductor/branch/main/graph/badge.svg?token=CJ4U0H7AKA)](https://codecov.io/gh/FAIMS/FAIMS3-conductor)

The server-side of FAIMS3 handling authentication and authorization

To get started, first set up the `.env` file as specified in Configuration, and
then set up keys as specified in Running.

## Configuration

The deployment is configured via the `.env` file in the root directory
of the project. Copy `.env.dist` to `.env` and the update the values
as required. See the deployment docs for full details of the environment
variables supported.

Environment variables are documented in comments in `.env.dist`.

## Key Generation

```bash
./keymanagement/makeInstanceKeys.sh
```

generates new key pair in the `keys` folder and generates the `local.ini` file for couchdb
that contains the public key and other information.

## Running with Docker

Build the two docker images:

```bash
docker compose build
```

Then we can startup the servers:

```bash

docker compose up -d
```

will start the couchdb and conductor servers to listen on the configured port.

## Running with Node

If you don't plan to use Docker to run or deploy Conductor, you need to get CouchDB
running on your host and enter the appropriate addresses in the `.env` file.
To run the Conductor server you first need to install dependencies:

```bash
npm install
```

You should then be able to run the server with:

```bash
npm start
```

If you are developing, you may want to run:

```bash
npm run watch
```

instead, which will monitor for changes with `nodemon`.

## Initialisation

Once the services are up and running we need to initialise the CouchDB
database. This is done with the migrate script:

```bash
npm run migrate
```

For development, there is also a script that will populate the database with projects (notebooks
or surveys) that are
stored in the `notebooks` directory. There should be two sample notebooks in
there but you can also create new ones.

```bash
npm run load-projects
```

Similarly, there is a script to populate project templates which again reads
all json files in the `notebooks` folder:

```bash
npm run load-templates
```

## Development

There is an alternate docker compose file for development that mounts the
current working directory inside the container so that you can work on
code in real time. To use this you also need a local `node_modules` folder
since the current directory will shadow the one inside the container.

To create `node_modules` run `npm ci` inside the container:

```bash
docker compose -f docker-compose.dev.yml run conductor npm ci
```

Then start the services:

```bash
docker compose -f docker-compose.dev.yml up
```

## Tests

Run tests inside the conductor instance:

```bash

docker compose exec conductor npm run test
```

## Email Service

The Email Service provides a standardised interface for sending emails from the application with support for multiple implementations and error handling.

### Email Configuration

#### Environment Variables

Add these to your `.env` file or other deployment `.env` configuration (included in `.env.dist`):

```bash
# Email Service Type (SMTP or MOCK)
EMAIL_SERVICE_TYPE=SMTP
# Sender Information
EMAIL_FROM_ADDRESS=notifications@example.com
EMAIL_FROM_NAME=FAIMS Notification
EMAIL_REPLY_TO=support@example.com
# SMTP Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=smtp_username
SMTP_PASSWORD=smtp_password
# Test Email for Admin Verification
TEST_EMAIL_ADDRESS=test@example.com
```

### Service Implementations

#### SMTP Service

Production implementation that sends real emails via an SMTP server. Includes connection caching for performance.

#### Mock Service

Test implementation that records sent emails for verification. Use by setting `EMAIL_SERVICE_TYPE=MOCK`.

### Usage

#### Basic Email

```typescript
import {EMAIL_SERVICE} from '../buildconfig';

await EMAIL_SERVICE.sendEmail({
  options: {
    to: 'recipient@example.com',
    subject: 'Email Subject',
    text: 'Plain text version',
    html: '<p>HTML version</p>',
  },
});
```

#### With Attachments

```typescript
await EMAIL_SERVICE.sendEmail({
  options: {
    to: 'recipient@example.com',
    subject: 'Email with Attachment',
    text: 'See attached document',
    attachments: [
      {
        filename: 'document.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  },
});
```

### Admin Features

#### Test Email Route

Administrators can verify email service configuration:

```HTTP
POST /api/admin/test-email
```

Requires cluster admin authentication. Returns detailed diagnostics including timing and error suggestions.

### Testing

Use the Mock implementation with `EMAIL_SERVICE_TYPE=MOCK` for testing. Access sent emails for verification:

```typescript
const mockEmailService = EMAIL_SERVICE as MockEmailService;
const sentEmails = mockEmailService.getSentEmails();
```
