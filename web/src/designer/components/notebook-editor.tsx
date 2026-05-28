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
  Tooltip,
  Typography,
} from '@mui/material';
import {Link, Outlet, useLocation} from 'react-router-dom';
import {useCallback, useEffect, useState} from 'react';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import {useDesignerUndoRedo} from '../state/use-designer-undo-redo';
import {
  designerCancelButtonSx,
  designerResponsiveFrameSx,
} from './designer-style';

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
  const [previewForm, setPreviewForm] = useState(false);

  const tabIndex = pathname.startsWith('/design/')
    ? pathname.split('/')[2]
    : '0';

  // State for toast notifications
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const onUndoRedoMessage = useCallback((message: string) => {
    setToastMessage(message);
    setToastOpen(true);
  }, []);

  const {canUndo, canRedo, undo, redo} = useDesignerUndoRedo(
    onUndoRedoMessage
  );

  const handleToastClose = (
    _event?: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setToastOpen(false);
  };

  // Keyboard shortcuts for undo/redo
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'z'
      ) {
        event.preventDefault();
        undo();
      } else if (
        (event.ctrlKey || event.metaKey) &&
        (event.key.toLowerCase() === 'y' ||
          (event.shiftKey && event.key.toLowerCase() === 'z'))
      ) {
        event.preventDefault();
        redo();
      }
    },
    [redo, undo]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const toolbarSx = {
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
    pt: 1.25,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  } as const;

  return (
    <>
      <TabContext value={pathname}>
        <Box
          sx={{
            ...designerResponsiveFrameSx,
            position: 'sticky',
            top: 0,
            zIndex: 100,
            bgcolor: 'background.paper',
            borderBottom: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.025)',
          }}
        >
          <Box>
            <TabList
              aria-label="Designer navigation tabs"
              sx={{
                width: 'fit-content',
                '& .MuiTabs-indicator': {height: 2},
              }}
            >
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
            <Stack direction="row" spacing={1} alignItems="center">
              {isDesignRoute && (
                <>
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    onClick={onSave}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      boxShadow: 'none',
                      minWidth: 72,
                      fontSize: '0.78rem',
                      py: 0.4,
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    onClick={onCancelRequest}
                    color="primary"
                    size="small"
                    sx={{
                      ...designerCancelButtonSx,
                      fontSize: '0.78rem',
                      py: 0.4,
                      minWidth: 72,
                    }}
                  >
                    Cancel
                  </Button>
                  <Tooltip
                    title={
                      canUndo ? 'Undo last change (Ctrl/Cmd+Z)' : 'No changes to undo'
                    }
                  >
                    <span>
                      <Button
                        variant={canUndo ? 'contained' : 'outlined'}
                        color="primary"
                        size="small"
                        startIcon={<UndoIcon sx={{fontSize: '1rem !important'}} />}
                        onClick={undo}
                        disabled={!canUndo}
                        sx={{minWidth: 84, fontSize: '0.78rem', py: 0.4}}
                      >
                        Undo
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip
                    title={
                      canRedo
                        ? 'Redo last undone change (Ctrl/Cmd+Y)'
                        : 'No changes to redo'
                    }
                  >
                    <span>
                      <Button
                        variant={canRedo ? 'contained' : 'outlined'}
                        color="primary"
                        size="small"
                        startIcon={<RedoIcon sx={{fontSize: '1rem !important'}} />}
                        onClick={redo}
                        disabled={!canRedo}
                        sx={{minWidth: 84, fontSize: '0.78rem', py: 0.4}}
                      >
                        Redo
                      </Button>
                    </span>
                  </Tooltip>
                  <FormControlLabel
                    sx={{
                      ml: 0.5,
                      alignItems: 'center',
                      '& .MuiFormControlLabel-label': {
                        display: 'flex',
                        alignItems: 'center',
                        color: 'text.secondary',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                      },
                    }}
                    label={
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={0.5}
                        sx={{userSelect: 'none'}}
                      >
                        <Typography variant="body2" sx={{fontWeight: 600}}>
                          Preview
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.disabled',
                            lineHeight: 1,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          {previewForm ? 'On' : 'Off'}
                        </Typography>
                      </Stack>
                    }
                    control={
                      <Switch
                        size="small"
                        checked={previewForm}
                        onChange={e => setPreviewForm(e.target.checked)}
                      />
                    }
                  />
                  {!isDesignRoute && (
                    <Button variant="contained" size="small" onClick={onSave}>
                      Save
                    </Button>
                  )}
                </>
              )}
            </Stack>
          </Box>
        </Box>
        <Box sx={[contentSx, designerResponsiveFrameSx]}>
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
