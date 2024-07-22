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
import ReactDOM from 'react-dom/client';
import {defineCustomElements} from '@ionic/pwa-elements/loader';

import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import {addNativeHooks} from './native_hooks';
// import {EFooter} from './footer';
//import reportWebVitals from './reportWebVitals';
import React from 'react';
import {registerClient} from 'faims3-datamodel';
import {getDataDB, getProjectDB} from './sync';
import {shouldDisplayRecord} from './users';

// set up the database module faims3-datamodel with our callbacks to get databases
registerClient({
  getDataDB: getDataDB,
  getProjectDB: getProjectDB,
  shouldDisplayRecord: shouldDisplayRecord,
});

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
