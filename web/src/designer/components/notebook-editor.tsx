/* eslint-disable n/no-extraneous-import */
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

/**
 * @file Top-level designer chrome: Design vs Info routing tabs.
 */

import {TabContext, TabList} from '@mui/lab';
import {
  Box,
  Button,
  FormControlLabel,
  Snackbar,
  Stack,
  Switch,
  Tab,
} from '@mui/material';
import {Link, Outlet, useLocation} from 'react-router-dom';
import {useCallback, useEffect, useState} from 'react';
// eslint-disable-next-line n/no-extraneous-import
import {ActionCreators} from 'redux-undo';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import {useAppDispatch, useAppSelector} from '../state/hooks';

/** Layout shell: Design / Info tabs and `Outlet` for nested designer routes. */
export type NotebookEditorProps = {
  onSave: () => void;
  onCancelRequest: () => void;
};

export type PreviewOutletContext = {
  previewForm: boolean;
  setPreviewForm: (preview: boolean) => void;
};

export const NotebookEditor = ({
  onSave,
  onCancelRequest,
}: NotebookEditorProps) => {
  const {pathname} = useLocation();
  const isDesignRoute = pathname.startsWith('/design/');
  const dispatch = useAppDispatch();
  const [previewForm, setPreviewForm] = useState(false);

  const tabIndex = pathname.startsWith('/design/')
    ? pathname.split('/')[2]
    : '0';

  // State for toast notifications
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  //  redux-undo state to determine if there is something to undo/redo
  const undoableState = useAppSelector(
    state => state.notebook['ui-specification']
  );
  const canUndo = undoableState.past.length > 0;
  const canRedo = undoableState.future.length > 0;

  const handleToastClose = (
    _event?: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setToastOpen(false);
  };

  const handleUndo = useCallback(() => {
    if (!canUndo) {
      setToastMessage('Nothing to undo');
      setToastOpen(true);
      return;
    }
    dispatch(ActionCreators.undo());
    setToastMessage('Undo complete');
    setToastOpen(true);
  }, [canUndo, dispatch]);

  const handleRedo = useCallback(() => {
    if (!canRedo) {
      setToastMessage('Nothing to redo');
      setToastOpen(true);
      return;
    }
    dispatch(ActionCreators.redo());
    setToastMessage('Redo complete');
    setToastOpen(true);
  }, [canRedo, dispatch]);

  // Keyboard shortcuts for undo/redo
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'z'
      ) {
        event.preventDefault();
        handleUndo();
      } else if (
        (event.ctrlKey || event.metaKey) &&
        (event.key.toLowerCase() === 'y' ||
          (event.shiftKey && event.key.toLowerCase() === 'z'))
      ) {
        event.preventDefault();
        handleRedo();
      }
    },
    [handleRedo, handleUndo]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const toolbarSx = {
    borderBottom: 1,
    borderColor: 'divider',
    px: 3,
    py: 1.25,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 2,
    flexWrap: 'wrap',
  } as const;

  const contentSx = {
    px: 3,
    pb: 3,
    pt: 2,
    display: 'flex',
    flexDirection: 'column',
    gap: 1.5,
  } as const;

  return (
    <>
      <TabContext value={pathname}>
        <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
          <TabList aria-label="lab API tabs example">
            <Tab
              label="Design"
              component={Link}
              to={`/design/${tabIndex}`}
              value={`/design/${tabIndex}`}
            />
            <Tab label="Info" component={Link} to="/info" value="/info" />
          </TabList>
        </Box>
        <Box sx={toolbarSx}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            {isDesignRoute && (
              <>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={onSave}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    boxShadow: 'none',
                    minWidth: 92,
                  }}
                >
                  Save
                </Button>
                <Button
                  onClick={onCancelRequest}
                  color="primary"
                  sx={{textTransform: 'uppercase', fontWeight: 700}}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  color="inherit"
                  startIcon={<UndoIcon />}
                  onClick={handleUndo}
                  disabled={!canUndo}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    boxShadow: 'none',
                  }}
                >
                  Undo
                </Button>
                <Button
                  variant="contained"
                  color="inherit"
                  startIcon={<RedoIcon />}
                  onClick={handleRedo}
                  disabled={!canRedo}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    boxShadow: 'none',
                  }}
                >
                  Redo
                </Button>
                <FormControlLabel
                  sx={{
                    '& .MuiFormControlLabel-label': {
                      color: 'text.secondary',
                      fontWeight: 600,
                    },
                  }}
                  label="Preview"
                  control={
                    <Switch
                      checked={previewForm}
                      onChange={e => setPreviewForm(e.target.checked)}
                    />
                  }
                />
              </>
            )}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            {!isDesignRoute && (
              <Button variant="contained" onClick={onSave}>
                Save
              </Button>
            )}
          </Stack>
        </Box>
        <Box sx={contentSx}>
          <Outlet context={{previewForm, setPreviewForm}} />
        </Box>
      </TabContext>
      <Snackbar
        open={toastOpen}
        autoHideDuration={3000}
        onClose={handleToastClose}
        message={toastMessage}
      />
    </>
  );
};
