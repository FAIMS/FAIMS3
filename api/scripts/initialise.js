/* eslint-disable node/no-unpublished-require */
/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: initialise.js
 * Description:
 *   Initialise the couchdb instance with required databases
 */

// how to import fetch in a node script...
// needed to add this file to .eslintignore because it complains about 'import'
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const CONDUCTOR_URL = process.env.CONDUCTOR_PUBLIC_URL;

const main = async () => {
  // Check if --force flag is present in command line arguments
  const forceFlag = process.argv.includes('--force');
  const endpoint = forceFlag ? '/api/forceInitialise/' : '/api/initialise/';

  // If force flag is present, we need to authenticate
  if (forceFlag) {
    if (!process.env.USER_TOKEN) {
      console.log(
        'USER_TOKEN not set in .env - login to Conductor and copy your user token'
      );
      process.exit();
    }
    
    const token = JSON.parse(
      Buffer.from(process.env.USER_TOKEN, 'base64').toString()
    );

    fetch(CONDUCTOR_URL + endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.jwt_token}`,
        'Content-Type': 'application/json',
      }
    })
    .then(response => response.json())
    .then(data => {
      console.log('data:', data);
    })
    .catch(error => {
      console.log(error);
    });
  } else {
    // Regular initialization without authentication
    fetch(CONDUCTOR_URL + endpoint, {
      method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
      console.log('data:', data);
    })
    .catch(error => {
      console.log(error);
    });
  }
};

main();