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

  fetch(CONDUCTOR_URL + '/api/initialise/', {
    method: 'POST'
  })
  .then(response => response.json())
  .then(data => {
    console.log('data:', data);
  })
  .catch(error => {
    console.log(error);
  })

};


main()
