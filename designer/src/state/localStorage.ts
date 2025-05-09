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

import {AppState, NotebookWithHistory} from './initial';
import {slugify} from './helpers/uiSpec-helpers';

// The following functions are inspired by Dan Abramov's lesson on persisting redux state to localStorage,
// see https://egghead.io/lessons/javascript-redux-persisting-the-state-to-the-local-storage.
export const loadState = () => {
  try {
    const serializedState = localStorage.getItem('notebook');
    return serializedState
      ? (JSON.parse(serializedState) as AppState)
      : undefined;
  } catch (error: unknown) {
    return undefined;
  }
};

export const saveState = (state: AppState) => {
  try {
    const serializedState = JSON.stringify(state);
    localStorage.setItem('notebook', serializedState);
  } catch (error: unknown) {
    console.log(error);
  }
};

export const downloadNotebook = (notebook: NotebookWithHistory) => {
  const actualNotebook = {
    metadata: notebook.metadata,
    'ui-specification': notebook['ui-specification'].present,
  };
  const element = document.createElement('a');
  const file = new Blob([JSON.stringify(actualNotebook, null, 2)], {
    type: 'application/json',
  });
  element.href = URL.createObjectURL(file);
  const name = slugify(actualNotebook.metadata.name as string);
  element.download = `${name}.json`;
  document.body.appendChild(element);
  element.click();
};
