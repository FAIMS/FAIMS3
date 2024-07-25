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
 * Filename: loadNotebooks.js
 * Description:
 *   Load notebooks into the running couchdb instance. 
 *   All json files named on the command line will be loa`ded.
 *   eg. `node scripts/loadNotebooks.js notebooks/*.json`
 */

const fs = require('fs');
// how to import fetch in a node script...
// needed to add this file to .eslintignore because it complains about 'import'
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)); 

const CONDUCTOR_URL = process.env.CONDUCTOR_PUBLIC_URL;

if (!process.env.USER_TOKEN) {
    console.log('USER_TOKEN not set in .env - login to Conductor and copy your user token');
    process.exit();
}

const token = JSON.parse(Buffer.from(process.env.USER_TOKEN, 'base64').toString());

const main = async filename => {
  console.log(filename);
  const jsonText = fs.readFileSync(filename, 'utf-8');
  const {metadata, 'ui-specification': uiSpec} = JSON.parse(jsonText);
  const name = metadata.name;
  fetch(CONDUCTOR_URL + '/api/notebooks/', {
    method: 'POST',
    headers: {'Authorization': `Bearer ${token.jwt_token}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({metadata, 'ui-specification': uiSpec, name}),
  })
  .then(response => response.json())
  .then(data => {
    console.log('data:', data);
  })
  .catch(error => {
    console.log(error);
  })
};


const extension = (filename) => {
    return filename.substring(filename.lastIndexOf('.')+1, filename.length) || filename;
}

if (process.argv.length > 2) {
    files = process.argv.slice(2);
    files.forEach(filename => {
      if (extension(filename) === 'json') {
          main(filename);
      }
  });
}
