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

import './App.css';
import { NotebookEditor } from './components/notebook-editor';
import { store } from './state/store';
import { Provider } from 'react-redux';
import { ThemeProvider } from "@mui/material/styles";
import globalTheme from "./theme/index";
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { InfoPanel } from './components/info-panel';
import { DesignPanel } from './components/design-panel';
import { ReviewPanel } from './components/review-panel';
import { NotebookLoader } from './components/notebook-loader';

const router = createBrowserRouter([
  {path: "/",
    element:<NotebookEditor />,
    children: [
      {
        index: true,
        element: <NotebookLoader />,
      },
      {
        path: "info",
        element: <InfoPanel />,
      },
      {
        path: "design/*", element: <DesignPanel />,
      },
      {
        path: "export",
        element: <ReviewPanel />,
      },
    ],
  },
]);

function App() {
  return (
    <ThemeProvider theme={globalTheme}>
      <Provider store={store}>
        <RouterProvider router={router}/>
      </Provider>
    </ThemeProvider>
  )
}

export default App
