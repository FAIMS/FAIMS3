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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Description:
 *   Preview, rename, and delete a downloaded offline map.
 */

import {
  extent3857ToOfflineMapRegion,
  formatOfflineMapSizeBytes,
  OfflineMapRegionEditor,
  ProgressBar,
  tileSetDisplayName,
  tileSetDownloadProgress,
  VectorTileStore,
  type StoredTileSet,
} from '@faims3/forms';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {useEffect, useMemo, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {getMapConfig} from '../../../buildconfig';
import * as ROUTES from '../../../constants/routes';
import BackButton from '../ui/BackButton';

export function EditOfflineMap() {
  const navigate = useNavigate();
  const {offlineMapId} = useParams<{offlineMapId: string}>();
  const [tileSet, setTileSet] = useState<StoredTileSet | null>(null);
  // Whether the offline map is still loading.
  const [loading, setLoading] = useState(true);
  // Error message shown on the page.
  const [message, setMessage] = useState('');
  // Whether the rename dialog is open.
  const [renameOpen, setRenameOpen] = useState(false);
  // Current value of the rename input.
  const [renameValue, setRenameValue] = useState('');
  // Whether the rename operation is in progress.
  const [renaming, setRenaming] = useState(false);
  // Whether the delete confirmation dialog is open.
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Whether the delete operation is in progress.
  const [deleting, setDeleting] = useState(false);

  // Offline downloads are vector-only, matching the existing download flow.
  const mapConfig = useMemo(() => {
    const {satelliteSource: _satellite, ...vectorOnly} = getMapConfig();
    return vectorOnly;
  }, []);

  const tileStore = useMemo(() => new VectorTileStore(mapConfig), [mapConfig]);

  useEffect(() => {
    let active = true;

    const loadTileSet = async () => {
      setLoading(true);
      setTileSet(null);
      setMessage('');

      if (!offlineMapId) {
        setMessage('Offline map could not be identified');
        setLoading(false);
        console.error(
          '[Offline map edit] Offline map id is missing from route params'
        );
        return;
      }

      try {
        await tileStore.tileStore.initDB();
        const tileSet = await tileStore.getTileSet(offlineMapId);

        if (!active) {
          return;
        }

        if (!tileSet) {
          setMessage('Offline map not found');
          return;
        }

        setTileSet(tileSet);
        setRenameValue(tileSetDisplayName(tileSet));
      } catch (loadError) {
        if (active) {
          setMessage(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load offline map'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadTileSet();

    return () => {
      active = false;
    };
  }, [offlineMapId, tileStore]);

  const handleRename = async () => {
    if (!offlineMapId || !renameValue.trim()) {
      return;
    }

    setRenaming(true);
    setMessage('');
    try {
      const updated = await tileStore.renameTileSet(
        offlineMapId,
        renameValue.trim()
      );
      setTileSet(updated);
      setRenameOpen(false);
    } catch (renameError) {
      setMessage(
        renameError instanceof Error
          ? renameError.message
          : 'Could not rename offline map'
      );
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!offlineMapId) {
      return;
    }

    setDeleting(true);
    setMessage('');
    try {
      await tileStore.removeTileSet(offlineMapId);
      navigate(ROUTES.OFFLINE_MAPS);
    } catch (deleteError) {
      setMessage(
        deleteError instanceof Error
          ? deleteError.message
          : 'Could not delete offline map'
      );
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{mx: 'auto', width: '100%', px: 2, py: 3}}>
        <Typography>Loading offline map…</Typography>
      </Box>
    );
  }

  if (!tileSet) {
    return (
      <Box sx={{mx: 'auto', width: '100%', px: 2, py: 3}}>
        <Stack spacing={2}>
          <BackButton link={ROUTES.OFFLINE_MAPS} />
          <Alert severity="error">{message || 'Offline map not found'}</Alert>
        </Stack>
      </Box>
    );
  }

  const displayRegion =
    tileSet.offlineMapRegion ?? extent3857ToOfflineMapRegion(tileSet.extent);
  const progress = tileSetDownloadProgress(tileSet);
  const isDownloading = progress !== null && progress < 1;

  return (
    <Box
      sx={{
        mx: 'auto',
        width: '100%',
        height: '100%',
        px: 2,
        pt: 3,
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={1}
          sx={{justifyContent: 'space-between', alignItems: 'center'}}
        >
          <BackButton link={ROUTES.OFFLINE_MAPS} />
          <Typography
            variant="h4"
            sx={{flex: 1, minWidth: 0, textAlign: 'center'}}
          >
            Edit offline map
          </Typography>
        </Stack>

        <Typography
          variant="h5"
          sx={{
            overflowWrap: 'anywhere',
            whiteSpace: 'normal',
            fontWeight: 'bold',
          }}
        >
          {tileSetDisplayName(tileSet)}
        </Typography>

        <Stack direction="row" spacing={4}>
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{fontWeight: 'bold'}}
            >
              Size
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatOfflineMapSizeBytes(tileSet.size)}
            </Typography>
          </Box>
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{fontWeight: 'bold'}}
            >
              Downloaded on
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {tileSet.created.toLocaleDateString()}
            </Typography>
          </Box>
        </Stack>

        {isDownloading && <ProgressBar completion={progress} />}

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            size="small"
            endIcon={<EditIcon />}
            onClick={() => {
              setRenameValue(tileSetDisplayName(tileSet));
              setRenameOpen(true);
            }}
          >
            Rename
          </Button>
          <Button
            variant="contained"
            size="small"
            color="error"
            endIcon={<DeleteIcon />}
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </Button>
        </Stack>

        {message && <Alert severity="error">{message}</Alert>}

        <OfflineMapRegionEditor
          config={mapConfig}
          region={displayRegion}
          onRegionChange={() => {}}
          readOnly
          showRegionStatus={false}
          showMapControls={false}
          mapHeight="clamp(380px, 55dvh, 650px)"
          mapComponentProps={{autoFlyToCurrentLocation: false}}
        />
      </Stack>

      {/* Dialog - Rename map name / label */}
      <Dialog
        open={renameOpen}
        onClose={() => !renaming && setRenameOpen(false)}
      >
        <DialogTitle>Rename offline map</DialogTitle>
        <DialogContent sx={{pt: '12px !important'}}>
          <TextField
            autoFocus
            fullWidth
            label="New map name"
            value={renameValue}
            onChange={event => setRenameValue(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameOpen(false)} disabled={renaming}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleRename}
            disabled={!renameValue.trim() || renaming}
          >
            {renaming ? 'Renaming…' : 'Rename'}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Dialog - Delete current map */}
      <Dialog
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
      >
        <DialogTitle>Delete offline map</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This will remove <strong>{tileSetDisplayName(tileSet)}</strong> and
            its downloaded tiles from this device.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
