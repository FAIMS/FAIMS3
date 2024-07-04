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

// Component to load a notebook file and initialise the state
import {styled} from '@mui/material/styles';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import {Grid, Button, Typography} from "@mui/material";
import {initialState, Notebook} from '../state/initial';
import { useAppDispatch } from '../state/hooks';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

const validateNotebook = (jsonText: string): Notebook => {
    try {
        const data = JSON.parse(jsonText);

        if (typeof data !== 'object') {
            throw new Error('Invalid notebook file: not an object');
        }

        if (!Object.prototype.hasOwnProperty.call(data, 'metadata')) {
            throw new Error('Invalid notebook file: metadata missing');
        }

        if (!Object.prototype.hasOwnProperty.call(data, 'ui-specification')) {
            throw new Error('Invalid notebook file: ui-specification missing');
        }

        return data as Notebook;
    } catch (error) {
        throw new Error('Invalid notebook file: not JSON');
    }
};

export const NotebookLoader = () => {

    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const loadFn = useCallback((notebook: Notebook) => {
        dispatch({ type: 'metadata/loaded', payload: notebook.metadata })
        dispatch({ type: 'ui-specification/loaded', payload: notebook['ui-specification'] })
    }, [dispatch]);

    const afterLoad = () =>  {
        navigate("/info");
    }

    const newNotebook = () => {
        loadFn(initialState);
        afterLoad();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.item(0);
        if (file) {
            file.text()
                .then(text => {
                    const data = validateNotebook(text);
                    loadFn(data);
                    afterLoad();
                })
            .catch((error) => {
            console.error(error); 
            });
        }
    };

    return (
        <Grid container spacing={2} pt={3}>
            <Grid item xs={12} sm={6}>
                <Button component="label" 
                        variant="contained" 
                        startIcon={<CloudUploadIcon />}>
                    Upload file
                    <VisuallyHiddenInput type="file" onChange={handleFileChange} />
                </Button>

                <Typography variant="body2" color="text.secondary">
                   Upload a notebook file to start editing.
                </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>                           
                <Button variant="contained" onClick={newNotebook}>
                    New Notebook
                </Button>
                <Typography variant="body2" color="text.secondary">
                    Create a new notebook from scratch.
                </Typography>
            </Grid>
        </Grid>
  );
};