// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Middleware, configureStore } from '@reduxjs/toolkit'
import metadataReducer from './metadata-reducer'
import uiSpecificationReducer from './uiSpec-reducer'
import { ToolkitStore } from '@reduxjs/toolkit/dist/configureStore';
import { Notebook } from './initial';
import { loadState, saveState } from './localStorage';
import { throttle } from 'lodash';

const persistedState = loadState();

const loggerMiddleware: Middleware<object, Notebook> = storeAPI => next => action => {
  console.log('dispatching', action);
  next(action);
  console.log('next state', storeAPI.getState())
}

export const store: ToolkitStore<Notebook> = configureStore({
  reducer: {
    metadata: metadataReducer,
    "ui-specification": uiSpecificationReducer
  },
  preloadedState: persistedState,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(loggerMiddleware),
})

// Write to localStorage at most once per second
store.subscribe(throttle(() => {
  saveState(store.getState());
}, 1000));

export type AppDispatch = typeof store.dispatch