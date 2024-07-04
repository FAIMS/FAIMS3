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

import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { initialState, NotebookMetadata} from "./initial";

const protectedFields = ['meta', 'project_status', 'access', 'accesses', 
                         'forms', 'filenames', 'ispublic', 'isrequest', 'sections'];

const metadataReducer = createSlice({
    name: 'metadata',
    initialState:  initialState.metadata,
    reducers: {
        loaded: (_state: NotebookMetadata, action: PayloadAction<NotebookMetadata>) => {
            return action.payload;
        },
        propertyUpdated: (state: NotebookMetadata, action: PayloadAction<{property: string, value: string}>) => {
            const { property, value } = action.payload;
            if (protectedFields.includes(property)) {
                throw new Error(`Cannot update protected metadata field ${property} via propertyUpdated action`);
            } else {
                state[property] = value;
            }
        },
        rolesUpdated: (state: NotebookMetadata, action: PayloadAction<{roles: string[]}>) => {
            const { roles } = action.payload;
            state.accesses = roles;
        },
    }
});

export const { loaded, propertyUpdated, rolesUpdated } = metadataReducer.actions;

export default metadataReducer.reducer;

