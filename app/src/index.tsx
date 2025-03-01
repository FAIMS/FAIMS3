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
 * Filename: index.tsx
 * Description:
 *   TODO
 */
import {ProjectDataObject, registerClient} from '@faims3/data-model';
import {defineCustomElements} from '@ionic/pwa-elements/loader';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import {APP_NAME} from './buildconfig';
import {databaseService} from './context/slices/helpers/databaseService';
import {selectAllProjects} from './context/slices/projectSlice';
import {store} from './context/store';
import './index.css';
import {addNativeHooks} from './native_hooks';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import {shouldDisplayRecord} from './users';

const getDataDB = async (
  projectId: string
): Promise<PouchDB.Database<ProjectDataObject>> => {
  const projectState = store.getState();
  const dbId = selectAllProjects(projectState).find(
    p => p.projectId === projectId
  )?.database?.localDbId;
  if (!dbId) {
    throw Error(
      `Could not get Data DB for project with ID. The project store does not contain a reference to this project database ${projectId}.`
    );
  }
  const db = databaseService.getLocalDatabase(dbId);
  if (!db) {
    throw Error(
      `Could not get Data DB for project with ID: ${projectId}. Database service missing entry.`
    );
  }
  return db;
};

// set up the database module @faims3/data-model with our callbacks to get databases
registerClient({
  // This will consult with the store to get the current data DB for the
  // project
  getDataDB: getDataDB,
  // This will determine if a record should be displayed
  shouldDisplayRecord: shouldDisplayRecord,
});

// Change the page title to configured app name
document.getElementsByTagName('title')[0].innerText = APP_NAME;
// and the meta description tag
document
  .querySelector('meta[name=description]')
  ?.setAttribute('content', `${APP_NAME} app`);

addNativeHooks();
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

//ReactDOM.render(EFooter, document.getElementById('footer')); The footer is
//already being toggeled between in footer, we don't need to call it twice.
//Keeping this here though because it'd be super useful to have a different
//front page.

// Call the element loader after the app has been rendered the first time
defineCustomElements(window);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
//reportWebVitals();

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://cra.link/PWA
serviceWorkerRegistration.register();
