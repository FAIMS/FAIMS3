import {Exif} from '@capacitor-community/exif';
import {Camera, CameraResultType, CameraSource, Photo} from '@capacitor/camera';
import {Capacitor} from '@capacitor/core';
import {Geolocation} from '@capacitor/geolocation';
import AddIcon from '@mui/icons-material/Add';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import SyncIcon from '@mui/icons-material/Sync';
import {Alert, Box, Paper, Tooltip, Typography, useTheme} from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import IconButton from '@mui/material/IconButton';
import ImageListItem from '@mui/material/ImageListItem';
import ImageListItemBar from '@mui/material/ImageListItemBar';
import {Buffer} from 'buffer';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {z} from 'zod';
import {
  CameraPermissionIssue,
  PhotosPermissionIssue,
} from '../../../components/PermissionAlerts';
import {PhotoLightbox} from '../../../components/PhotoLightbox';
import {FullFormConfig} from '../../../formModule/formManagers/types';
import {
  attachmentSaveTrace,
  BaseFieldParametersSchema,
} from '@faims3/data-model';
import {takePhotoIsComplete, takePhotoValueSchema} from './valueSchema';
import {FormFieldContextProps} from '../../../formModule/types';
import {
  LoadedPhoto,
  useAttachments,
  useAttachmentsResult,
} from '../../../hooks/useAttachment';
import {logError, logWarn} from '../../../logging';
import {TakePhotoRender} from '../../../rendering/fields/view/specialised/TakePhoto';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';
import {
  createConcurrencyLimiter,
  delayIfSlowPhotosDebug,
  MAX_PARALLEL_SAVES,
} from './parallelSaveLimiter';
import {
  IMAGE_QUALITY_0_100,
  MAX_IMAGE_WIDTH,
  preparePhotoBlobForStorage,
} from './webPhotoFallback';

const MAX_GALLERY_BATCH = 10;

/**
 * Backing out of the camera or picker rejects rather than returning empty, and
 * is a normal user action rather than a failure worth logging.
 */
const isCancellation = (err: unknown): boolean =>
  /cancel/i.test(err instanceof Error ? err.message : String(err ?? ''));

/** Capacitor iOS still rejects pickImages if Photo Library access was denied. */
const isPhotosAccessDenied = (err: unknown): boolean =>
  /denied access to photos/i.test(
    err instanceof Error ? err.message : String(err ?? '')
  );

type PhotosAccessIssue = 'denied' | 'limited';

/**
 * Capacitor's iOS pickImages still gates on PHPhotoLibrary authorization
 * (Limited / "Selected Photos" is treated as a deny). Android Photo Picker
 * and the web file input do not need this permission.
 */
const ensureIosPhotosAccess = async (): Promise<PhotosAccessIssue | null> => {
  if (Capacitor.getPlatform() !== 'ios') return null;

  let photos = (await Camera.checkPermissions()).photos;
  if (photos === 'prompt' || photos === 'prompt-with-rationale') {
    photos = (await Camera.requestPermissions({permissions: ['photos']}))
      .photos;
  }

  if (photos === 'granted') return null;
  return photos === 'limited' ? 'limited' : 'denied';
};

// Types & Schema
// ============================================================================

const takePhotoPropsSchema = BaseFieldParametersSchema.extend({});
type TakePhotoProps = z.infer<typeof takePhotoPropsSchema>;
type TakePhotoFieldProps = TakePhotoProps & FormFieldContextProps;

interface FullTakePhotoFieldProps extends TakePhotoFieldProps {
  config: FullFormConfig;
}

/**
 * Represents a photo that has been captured but not yet confirmed from the database.
 * Used for optimistic UI updates to show photos immediately after capture.
 */
interface PendingPhoto {
  /** The object URL for immediate display */
  url: string;
  /** The attachment ID assigned during storage (once known) */
  attachmentId: string | null;
  /** Timestamp for ordering */
  capturedAt: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Converts a base64 encoded image to a Blob object.
 * Used for web platform photo handling.
 */
async function base64ImageToBlob(image: Photo): Promise<Blob> {
  if (!image.base64String) {
    throw new Error('No photo data found');
  }

  const buffer = Buffer.from(image.base64String, 'base64');
  const content = new Uint8Array(buffer);

  return new Blob([content], {
    type: `image/${image.format}`,
  });
}

// ============================================================================
// Preview Mode Component
// ============================================================================

/**
 * Preview mode component - shows a non-interactive placeholder display.
 * Used when the form is in preview/read-only mode.
 */
const TakePhotoPreview: React.FC<TakePhotoFieldProps> = props => {
  const {label, helperText, required, advancedHelperText, state} = props;
  const theme = useTheme();
  const photoCount = state.value?.attachments?.length || 0;

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
      errors={props.state.meta.errors as unknown as string[]}
    >
      <Paper
        sx={{
          padding: theme.spacing(4),
          textAlign: 'center',
          bgcolor: theme.palette.grey[100],
          borderRadius: theme.spacing(2),
          marginTop: theme.spacing(2),
        }}
      >
        <CameraAltIcon sx={{fontSize: 48, color: 'text.secondary', mb: 2}} />
        <Typography variant="h6" gutterBottom>
          Photo Field (Preview Mode)
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {photoCount === 0
            ? 'No photos captured'
            : `${photoCount} photo${photoCount === 1 ? '' : 's'} attached`}
        </Typography>
      </Paper>
    </FieldWrapper>
  );
};

// ============================================================================
// UI Components
// ============================================================================

const ACTION_ICON_PX = 36;
const ADD_BADGE_PX = 14;

/**
 * Single labelled action (icon with a "+" badge over a label). The glyph lives
 * in a fixed square so camera and gallery share a center line; the badge
 * overlays the corner and is kept out of layout so it cannot shift the icon.
 */
const ActionButton: React.FC<{
  icon: React.ReactElement;
  label: string;
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({icon, label, ariaLabel, onClick, disabled = false}) => {
  const theme = useTheme();

  return (
    <Box
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onKeyDown={
        disabled
          ? undefined
          : e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
      }
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.75,
        p: 0.5,
        cursor: disabled ? 'default' : 'pointer',
        borderRadius: theme.spacing(1),
        outline: 'none',
        transition: 'background-color 120ms ease',
        width: '100%',
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        '&:hover': disabled ? undefined : {bgcolor: theme.palette.action.hover},
        '&:focus-visible': disabled
          ? undefined
          : {bgcolor: theme.palette.action.hover},
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: ACTION_ICON_PX,
          height: ACTION_ICON_PX,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
          flexShrink: 0,
        }}
      >
        {icon}
        <Box
          sx={{
            position: 'absolute',
            right: -3,
            bottom: -3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: theme.palette.background.paper,
            borderRadius: '50%',
            lineHeight: 0,
          }}
        >
          <AddIcon
            sx={{
              fontSize: ADD_BADGE_PX,
              color: theme.palette.primary.main,
              stroke: theme.palette.primary.main,
              strokeWidth: 1.5,
            }}
          />
        </Box>
      </Box>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{whiteSpace: 'nowrap', lineHeight: 1.2}}
      >
        {label}
      </Typography>
    </Box>
  );
};

/**
 * The "Camera" + "Gallery" pair.
 *
 * Uses equal columns so the two icons share a common center line — otherwise
 * a wider label would pull the pair's visual center to the right.
 */
const PhotoActions: React.FC<{
  onAddPhoto: () => void;
  onPickFromGallery: () => void;
  justify?: 'center' | 'flex-start';
  /** Empty state: full-width centered row on narrow viewports. */
  stretchOnNarrow?: boolean;
  /** True while the camera/gallery picker is open or save slots are full. */
  actionsDisabled?: boolean;
  /** Tooltip shown on Camera/Gallery when `actionsDisabled` is true. */
  actionsDisabledReason?: string;
}> = ({
  onAddPhoto,
  onPickFromGallery,
  justify = 'center',
  stretchOnNarrow = false,
  actionsDisabled = false,
  actionsDisabledReason,
}) => {
  const theme = useTheme();

  const actionSlotSx = {
    display: 'flex',
    justifyContent: 'center',
    minWidth: 0,
    ...(stretchOnNarrow && {
      flex: {xs: 1, sm: 'unset'},
      width: {xs: '100%', sm: 'auto'},
    }),
  };

  return (
    <Box
      sx={{
        display: stretchOnNarrow
          ? {xs: 'flex', sm: 'inline-grid'}
          : 'inline-grid',
        gridTemplateColumns: '1fr 1fr',
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyItems: 'stretch',
        justifyContent: stretchOnNarrow ? {xs: 'center', sm: justify} : justify,
        width: stretchOnNarrow ? {xs: '100%', sm: 'auto'} : undefined,
        gap: 1.5,
      }}
    >
      <Tooltip
        title={
          actionsDisabled && actionsDisabledReason
            ? actionsDisabledReason
            : 'Take a new photo with your camera'
        }
      >
        <Box component="span" sx={actionSlotSx}>
          <ActionButton
            icon={
              <CameraAltIcon
                sx={{
                  display: 'block',
                  fontSize: ACTION_ICON_PX,
                  color: theme.palette.primary.main,
                }}
              />
            }
            label="Camera"
            ariaLabel="Camera"
            onClick={onAddPhoto}
            disabled={actionsDisabled}
          />
        </Box>
      </Tooltip>
      <Tooltip
        title={
          actionsDisabled && actionsDisabledReason
            ? actionsDisabledReason
            : 'Select multiple photos at once from your gallery'
        }
      >
        <Box component="span" sx={actionSlotSx}>
          <ActionButton
            icon={
              <PhotoLibraryIcon
                sx={{
                  display: 'block',
                  fontSize: ACTION_ICON_PX,
                  color: theme.palette.primary.main,
                }}
              />
            }
            label="Gallery"
            ariaLabel="Add photos from gallery, multiple selection allowed"
            onClick={onPickFromGallery}
            disabled={actionsDisabled}
          />
        </Box>
      </Tooltip>
    </Box>
  );
};

/**
 * Gallery tile: the action pair inside a card, sized as one grid cell so it
 * sits beside the photo thumbnails.
 */
const PhotoActionsTile: React.FC<{
  onAddPhoto: () => void;
  onPickFromGallery: () => void;
  actionsDisabled?: boolean;
  actionsDisabledReason?: string;
}> = ({
  onAddPhoto,
  onPickFromGallery,
  actionsDisabled = false,
  actionsDisabledReason,
}) => {
  const theme = useTheme();

  return (
    <Paper
      sx={{
        aspectRatio: '4/3',
        borderRadius: theme.spacing(1),
        boxShadow: theme.shadows[2],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 1,
        '&:hover': {boxShadow: theme.shadows[4]},
      }}
    >
      <PhotoActions
        onAddPhoto={onAddPhoto}
        onPickFromGallery={onPickFromGallery}
        actionsDisabled={actionsDisabled}
        actionsDisabledReason={actionsDisabledReason}
      />
    </Paper>
  );
};

/**
 * Empty state component displayed when no photos have been captured yet.
 * Shows the same action pair used in the gallery so the design stays consistent.
 */
const EmptyState: React.FC<{
  onAddPhoto: () => void;
  onPickFromGallery: () => void;
  disabled: boolean;
  actionsDisabled?: boolean;
  actionsDisabledReason?: string;
}> = ({
  onAddPhoto,
  onPickFromGallery,
  disabled,
  actionsDisabled = false,
  actionsDisabledReason,
}) => {
  const theme = useTheme();

  if (disabled) {
    return (
      <Paper
        sx={{
          padding: theme.spacing(4),
          textAlign: 'center',
          bgcolor: theme.palette.grey[100],
          borderRadius: theme.spacing(2),
          marginTop: theme.spacing(2),
        }}
      >
        <CameraAltIcon sx={{fontSize: 48, color: 'text.secondary', mb: 1}} />
        <Typography variant="body2" color="text.secondary">
          No photos
        </Typography>
      </Paper>
    );
  }

  return (
    <Box
      sx={{
        paddingY: theme.spacing(2),
      }}
    >
      <Typography variant="h6" sx={{mb: 1.5}}>
        No photos selected yet
      </Typography>
      <PhotoActions
        onAddPhoto={onAddPhoto}
        onPickFromGallery={onPickFromGallery}
        justify="flex-start"
        stretchOnNarrow
        actionsDisabled={actionsDisabled}
        actionsDisabledReason={actionsDisabledReason}
      />
    </Box>
  );
};

/**
 * Common container wrapper for all image list items.
 * Provides consistent sizing, spacing, and hover effects.
 */
const ImageItemContainer: React.FC<{
  children: React.ReactNode;
}> = ({children}) => {
  const theme = useTheme();

  return (
    <ImageListItem
      sx={{
        borderRadius: theme.spacing(1),
        overflow: 'hidden',
        boxShadow: theme.shadows[2],
        aspectRatio: '4/3',
        '&:hover': {
          boxShadow: theme.shadows[4],
        },
      }}
    >
      {children}
    </ImageListItem>
  );
};

/**
 * Placeholder shown when a photo attachment cannot be loaded.
 * Typically displayed when attachment download is disabled in settings.
 */
const UnavailableImagePlaceholder: React.FC = () => {
  return (
    <ImageItemContainer>
      <Paper
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(0, 0, 0, 0.05)',
          border: '2px dashed rgba(0, 0, 0, 0.2)',
          gap: 1,
          p: 1,
          cursor: 'default',
        }}
      >
        <CloudOffIcon sx={{fontSize: 36, color: 'rgba(0, 0, 0, 0.3)'}} />
        <Typography
          variant="caption"
          sx={{color: 'rgba(0, 0, 0, 0.5)', textAlign: 'center'}}
        >
          Attachment not available. Enable download in Settings
        </Typography>
      </Paper>
    </ImageItemContainer>
  );
};

/**
 * Loading state placeholder for photos being fetched.
 */
const LoadingImagePlaceholder: React.FC = () => {
  return (
    <ImageItemContainer>
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ImageIcon sx={{fontSize: 48, color: 'text.secondary'}} />
      </Box>
    </ImageItemContainer>
  );
};

/**
 * Individual photo item in the gallery grid.
 * Displays the photo thumbnail with a delete button overlay.
 */
const PhotoItem: React.FC<{
  data: LoadedPhoto;
  onDelete: () => void;
  onClick: () => void;
  deleteDisabled?: boolean;
}> = ({data, onDelete, onClick, deleteDisabled = false}) => {
  const theme = useTheme();

  return (
    <ImageItemContainer>
      <Box
        sx={{
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: theme.palette.grey[100],
        }}
      >
        <Box
          component="img"
          src={data.url}
          onClick={onClick}
          alt={`Photo ${data.metadata.filename}`}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            cursor: 'pointer',
          }}
        />
        <ImageListItemBar
          sx={{background: 'rgba(0, 0, 0, 0.7)'}}
          position="top"
          actionIcon={
            <IconButton
              sx={{color: 'white'}}
              onClick={e => {
                e.stopPropagation();
                onDelete();
              }}
              size="large"
              disabled={deleteDisabled}
              aria-label="Delete photo"
            >
              <DeleteIcon />
            </IconButton>
          }
          actionPosition="right"
        />
      </Box>
    </ImageItemContainer>
  );
};

/**
 * Pending photo item - shows optimistic preview while saving to database.
 * Displays a sync indicator overlay only while storage is still in progress.
 */
const PendingPhotoItem: React.FC<{
  url: string;
  onClick: () => void;
  /** False once the attachment is stored in PouchDB (load may still be in progress). */
  isSaving?: boolean;
}> = ({url, onClick, isSaving = true}) => {
  const theme = useTheme();

  return (
    <ImageItemContainer>
      <Box
        sx={{
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: theme.palette.grey[100],
        }}
      >
        <Box
          component="img"
          src={url}
          onClick={onClick}
          alt="Saving photo..."
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            cursor: 'pointer',
          }}
        />
        {/* Saving indicator overlay — only while blob is being written to PouchDB */}
        {isSaving && (
          <ImageListItemBar
            sx={{background: 'rgba(0, 0, 0, 0.7)'}}
            position="top"
            actionIcon={
              <Box sx={{display: 'flex', alignItems: 'center', pr: 1}}>
                <SyncIcon
                  sx={{
                    color: 'white',
                    fontSize: 20,
                    animation: 'spin 1s linear infinite',
                    '@keyframes spin': {
                      '0%': {transform: 'rotate(0deg)'},
                      '100%': {transform: 'rotate(360deg)'},
                    },
                  }}
                />
                <Typography variant="caption" sx={{color: 'white', ml: 0.5}}>
                  Saving...
                </Typography>
              </Box>
            }
            actionPosition="right"
          />
        )}
      </Box>
    </ImageItemContainer>
  );
};

/**
 * Unified photo entry for the gallery - can be either a loaded photo or a pending one.
 */
type GalleryPhoto =
  | {
      type: 'loaded';
      photo: useAttachmentsResult[number];
    }
  | {
      type: 'pending';
      pending: PendingPhoto;
      tempId: string;
    };

/**
 * Photo gallery component displaying all captured photos in a responsive grid.
 * Includes add photo button, delete confirmation, and lightbox functionality.
 * Now supports optimistic display of pending photos.
 */
const PhotoGallery: React.FC<{
  photos: useAttachmentsResult;
  pendingPhotos: Map<string, PendingPhoto>;
  onDelete: (attachmentId: string) => void;
  onAddPhoto: () => void;
  onPickFromGallery: () => void;
  disabled: boolean;
  /** True while the camera/gallery picker is open or save slots are full. */
  actionsDisabled?: boolean;
  /** Tooltip shown on Camera/Gallery when `actionsDisabled` is true. */
  actionsDisabledReason?: string;
  /** True while the camera/gallery picker is open (delete stays available during saves). */
  deleteDisabled?: boolean;
}> = ({
  photos,
  pendingPhotos,
  onDelete,
  onAddPhoto,
  onPickFromGallery,
  disabled,
  actionsDisabled = false,
  actionsDisabledReason,
  deleteDisabled = false,
}) => {
  const theme = useTheme();

  // Delete confirmation dialog state. Store the attachment id, not the
  // gallery index: addAttachment prepends, so a batch save finishing while
  // this dialog is open would shift every index and delete the wrong photo.
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);

  // Lightbox state - now stores URL directly to support both loaded and pending
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Handlers
  const handleDeleteClick = (attachmentId: string) => {
    setPhotoToDelete(attachmentId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (photoToDelete !== null) {
      onDelete(photoToDelete);
    }
    setPhotoToDelete(null);
    setDeleteDialogOpen(false);
  };

  const handleLightboxClose = () => {
    setLightboxUrl(null);
  };

  // Build unified gallery list: pending photos first (newest), then loaded photos (newest first)
  const galleryPhotos = useMemo((): GalleryPhoto[] => {
    const result: GalleryPhoto[] = [];

    // Add pending photos first (they're the newest), sorted by capture time descending
    const pendingEntries = Array.from(pendingPhotos.entries()).sort(
      ([, a], [, b]) => b.capturedAt - a.capturedAt
    );

    for (const [tempId, pending] of pendingEntries) {
      result.push({type: 'pending', pending, tempId});
    }

    // Add loaded photos. But skip any that have a pending photo with matching
    // attachmentId (to prevent duplicates during transition)
    const pendingAttachmentIds = new Set(
      Array.from(pendingPhotos.values())
        .map(p => p.attachmentId)
        .filter((id): id is string => id !== null)
    );

    for (const photo of photos) {
      // Skip if this photo is still showing as pending
      if (photo.data && pendingAttachmentIds.has(photo.data.id)) {
        continue;
      }
      result.push({type: 'loaded', photo});
    }

    return result;
  }, [photos, pendingPhotos]);

  return (
    <>
      <Box sx={{width: '100%'}}>
        <Box
          sx={{
            display: 'grid',
            gap: theme.spacing(1.5),
            padding: theme.spacing(1),
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            width: '100%',
          }}
        >
          {!disabled && (
            <PhotoActionsTile
              onAddPhoto={onAddPhoto}
              onPickFromGallery={onPickFromGallery}
              actionsDisabled={actionsDisabled}
              actionsDisabledReason={actionsDisabledReason}
            />
          )}

          {/* Photo Grid - unified pending + loaded */}
          {galleryPhotos.map((entry, displayIndex) => {
            if (entry.type === 'pending') {
              return (
                <PendingPhotoItem
                  key={`pending-${entry.tempId}`}
                  url={entry.pending.url}
                  onClick={() => setLightboxUrl(entry.pending.url)}
                  isSaving={entry.pending.attachmentId === null}
                />
              );
            }

            // Loaded photo
            const {photo} = entry;

            if (photo.isLoading) {
              return (
                <LoadingImagePlaceholder key={`loading-${displayIndex}`} />
              );
            }

            if (photo.isError || !photo.data) {
              return (
                <UnavailableImagePlaceholder key={`error-${displayIndex}`} />
              );
            }

            return (
              <PhotoItem
                key={photo.data.id}
                data={photo.data}
                onDelete={() => handleDeleteClick(photo.data.id)}
                onClick={() => setLightboxUrl(photo.data.url)}
                deleteDisabled={deleteDisabled}
              />
            );
          })}
        </Box>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: theme.spacing(2),
          },
        }}
      >
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this photo?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{px: 3, pb: 3}}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            variant="outlined"
            sx={{borderRadius: theme.spacing(1)}}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            disabled={deleteDisabled}
            sx={{borderRadius: theme.spacing(1), ml: 2}}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Lightbox */}
      {lightboxUrl && (
        <PhotoLightbox url={lightboxUrl} onClose={handleLightboxClose} />
      )}
    </>
  );
};

// ============================================================================
// Main Component (Full Mode)
// ============================================================================

/**
 * Main TakePhoto component in full interactive mode.
 * Handles photo capture from device camera, geolocation tagging (native),
 * attachment storage, and gallery display.
 *
 * Uses optimistic UI updates to show photos immediately after capture,
 * before the database write completes.
 */
const TakePhotoFull: React.FC<FullTakePhotoFieldProps> = props => {
  const {
    fieldId,
    label,
    helperText,
    required,
    advancedHelperText,
    disabled = false,
    state,
    addAttachment,
    removeAttachment,
    setAttachmentSaving,
    config: context,
  } = props;

  const appName = props.config.appName;
  const [noPermission, setNoPermission] = useState(false);
  const [noPhotosPermission, setNoPhotosPermission] =
    useState<PhotosAccessIssue | null>(null);

  // Optimistic photo display state
  // Key is a temporary ID, value contains the blob URL and eventual attachment ID
  const [pendingPhotos, setPendingPhotos] = useState<Map<string, PendingPhoto>>(
    new Map()
  );

  // Track URLs that need cleanup on unmount
  const pendingUrlsRef = useRef<Set<string>>(new Set());

  const [saveError, setSaveError] = useState<string | null>(null);

  // One native picker at a time. Saves are tracked separately so Camera /
  // Gallery stay usable while earlier photos show "Saving...".
  const pickerInFlightRef = useRef(false);
  const [pickerInFlight, setPickerInFlight] = useState(false);

  const saveLimiterRef = useRef(createConcurrencyLimiter(MAX_PARALLEL_SAVES));
  const savesInFlightRef = useRef(0);
  const [savesInFlight, setSavesInFlight] = useState(0);

  // One form-level lock for this field: held while the picker is open or any
  // save slot is held. Avoids a gap between releasing the picker and starting
  // the write. FormSection remounts on section change (key={activeSection});
  // without this lock the field can unmount mid-pick/save and the async work
  // continues on a dead instance.
  const formLockHeldRef = useRef(false);

  // Get attachment service (guaranteed to exist in full mode)
  const attachmentService = context.attachmentEngine();

  // Load all attachments for this field
  const loadedPhotos = useAttachments(
    (state.value?.attachments || []).map(att => att.attachmentId),
    attachmentService
  );

  // Effect to clean up pending photos once they appear in loadedPhotos
  // This prevents flickering by keeping the optimistic preview until DB confirms
  useEffect(() => {
    const loadedIds = new Set(
      loadedPhotos
        .filter(p => p.data && !p.isLoading && !p.isError)
        .map(p => p.data!.id)
    );

    setPendingPhotos(current => {
      const updated = new Map(current);
      let changed = false;

      for (const [tempId, pending] of current) {
        // Only remove if:
        // 1. We have an attachmentId (storage completed)
        // 2. That ID appears in successfully loaded photos
        if (pending.attachmentId && loadedIds.has(pending.attachmentId)) {
          // Clean up the object URL
          URL.revokeObjectURL(pending.url);
          pendingUrlsRef.current.delete(pending.url);
          updated.delete(tempId);
          changed = true;
        }
      }

      return changed ? updated : current;
    });
  }, [loadedPhotos]);

  // Cleanup all pending URLs on unmount
  useEffect(() => {
    return () => {
      for (const url of pendingUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      pendingUrlsRef.current.clear();
    };
  }, []);

  const syncFormLock = useCallback(() => {
    const shouldHold =
      pickerInFlightRef.current || savesInFlightRef.current > 0;
    if (shouldHold && !formLockHeldRef.current) {
      formLockHeldRef.current = true;
      setAttachmentSaving?.(true);
    } else if (!shouldHold && formLockHeldRef.current) {
      formLockHeldRef.current = false;
      setAttachmentSaving?.(false);
    }
  }, [setAttachmentSaving]);

  const beginPicker = useCallback(() => {
    pickerInFlightRef.current = true;
    setPickerInFlight(true);
    syncFormLock();
  }, [syncFormLock]);

  const endPicker = useCallback(() => {
    pickerInFlightRef.current = false;
    setPickerInFlight(false);
    syncFormLock();
  }, [syncFormLock]);

  /**
   * Takes a save slot. When a slot is free, the limiter grants inside the
   * Promise executor so `savesInFlightRef` is updated before the caller
   * `await`s — endPicker can then run without dropping the form lock.
   */
  const acquireSaveSlot = useCallback(() => {
    const acquired = saveLimiterRef.current.acquire();
    savesInFlightRef.current = saveLimiterRef.current.active;
    setSavesInFlight(saveLimiterRef.current.active);
    syncFormLock();
    return acquired.then(() => {
      savesInFlightRef.current = saveLimiterRef.current.active;
      setSavesInFlight(saveLimiterRef.current.active);
      syncFormLock();
    });
  }, [syncFormLock]);

  const releaseSaveSlot = useCallback(() => {
    saveLimiterRef.current.release();
    savesInFlightRef.current = saveLimiterRef.current.active;
    setSavesInFlight(saveLimiterRef.current.active);
    syncFormLock();
  }, [syncFormLock]);

  /**
   * Shows a thumbnail immediately and returns its temporary id. Kept separate
   * from storage so a batch can be previewed at once, before the slower
   * per-photo writes begin.
   */
  const addPendingPreview = useCallback((photoBlob: Blob): string => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const optimisticUrl = URL.createObjectURL(photoBlob);
    pendingUrlsRef.current.add(optimisticUrl);
    setPendingPhotos(current => {
      const updated = new Map(current);
      updated.set(tempId, {
        url: optimisticUrl,
        attachmentId: null,
        capturedAt: Date.now(),
      });
      return updated;
    });

    return tempId;
  }, []);

  /**
   * Drops an optimistic preview that will never be confirmed (save failed, or
   * batch aborted). Idempotent — safe to call after storage already succeeded.
   */
  const removePendingPhoto = useCallback((tempId: string) => {
    setPendingPhotos(current => {
      const pending = current.get(tempId);
      if (!pending) return current;
      URL.revokeObjectURL(pending.url);
      pendingUrlsRef.current.delete(pending.url);
      const updated = new Map(current);
      updated.delete(tempId);
      return updated;
    });
  }, []);

  /**
   * Writes one already-previewed image to storage. `path` is only supplied for
   * camera captures: geotagging uses the *current* position, which is only
   * correct for a photo taken here and now.
   */
  const storePhoto = useCallback(
    async ({
      tempId,
      photoBlob,
      format,
      path,
    }: {
      tempId: string;
      photoBlob: Blob;
      format: string;
      path?: string;
    }) => {
      if (Capacitor.getPlatform() !== 'web' && path) {
        // Native: attempt to add geolocation EXIF data
        try {
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });

          if (position) {
            await Exif.setCoordinates({
              pathToImage: path,
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          }
        } catch (e) {
          logWarn('Could not add geolocation to photo:', e);
        }
      }

      attachmentSaveTrace('TakePhoto:save-start', {
        fieldId,
        blobSize: photoBlob.size,
        format,
      });

      // No-op unless DEBUG_SLOW_PHOTOS is on, which stalls here to mimic a slow phone.
      await delayIfSlowPhotosDebug();

      let newId: string;
      try {
        newId = await addAttachment({
          // Blob attachments are faster - especially on native
          blob: photoBlob,
          contentType: `image/${format}`,
          type: 'photo',
          fileFormat: format,
        });
      } catch (err) {
        // Drop the optimistic preview so the user isn't left with a photo
        // stuck on "Saving..." forever. Rethrow so the caller can surface it.
        removePendingPhoto(tempId);
        throw err;
      }

      // Mark storage complete; keep optimistic preview until useAttachments loads.
      // The Saving overlay hides once attachmentId is set (see PendingPhotoItem).
      setPendingPhotos(current => {
        const updated = new Map(current);
        const pending = updated.get(tempId);
        if (pending) {
          updated.set(tempId, {...pending, attachmentId: newId});
        }
        return updated;
      });

      props.setFieldData((prev: string[] | undefined) => [
        ...(prev ?? []),
        newId,
      ]);

      attachmentSaveTrace('TakePhoto:save-complete', {
        fieldId,
        attachmentId: newId,
      });
    },
    [fieldId, addAttachment, removePendingPhoto]
  );

  /**
   * Opens the camera directly (no "take or select" prompt) so repeat capture is
   * a single tap. Selecting existing images is a separate control.
   */
  const takePhoto = useCallback(async () => {
    if (pickerInFlightRef.current) return;
    if (savesInFlightRef.current >= MAX_PARALLEL_SAVES) return;

    beginPicker();
    let saveSlotHeld = false;
    try {
      const isWeb = Capacitor.getPlatform() === 'web';

      // Check/request camera permission
      if (isWeb) {
        const permission = await navigator.permissions.query({
          name: 'camera' as PermissionName,
        });
        if (permission.state === 'denied') {
          setNoPermission(true);
          return;
        }
      } else {
        const permissions = await Camera.requestPermissions({
          permissions: ['camera'],
        });
        if (permissions.camera === 'denied') {
          setNoPermission(true);
          return;
        }
      }

      // Capture photo
      const photoResult = await Camera.getPhoto({
        quality: IMAGE_QUALITY_0_100,
        width: MAX_IMAGE_WIDTH,
        allowEditing: false,
        resultType: isWeb ? CameraResultType.Base64 : CameraResultType.Uri,
        correctOrientation: true,
        source: CameraSource.Camera,
      });

      let photoBlob: Blob;

      if (isWeb) {
        // Web
        photoBlob = await base64ImageToBlob(photoResult);
      } else {
        // Native
        if (!photoResult.webPath) {
          throw new Error('Photo webPath is undefined');
        }
        const response = await fetch(photoResult.webPath);
        photoBlob = await response.blob();
      }

      // Web plugin ignores quality/width on getPhoto too; native already
      // resized. See preparePhotoBlobForStorage.
      const prepared = await preparePhotoBlobForStorage(
        photoBlob,
        photoResult.format
      );

      setSaveError(null);
      const tempId = addPendingPreview(prepared.photoBlob);

      // Take a save slot before releasing the picker so the form lock is
      // never dropped between capture and the PouchDB write.
      await acquireSaveSlot();
      saveSlotHeld = true;
      endPicker();

      try {
        await storePhoto({
          tempId,
          photoBlob: prepared.photoBlob,
          format: prepared.format,
          path: photoResult.path,
        });
      } finally {
        releaseSaveSlot();
        saveSlotHeld = false;
      }
    } catch (err: unknown) {
      if (isCancellation(err)) return;
      logError(new Error('Failed to capture photo:'), {error: err});
      setSaveError('Could not save the photo. Please try again.');
    } finally {
      if (pickerInFlightRef.current) {
        endPicker();
      }
      if (saveSlotHeld) {
        releaseSaveSlot();
      }
    }
  }, [
    addPendingPreview,
    storePhoto,
    beginPicker,
    endPicker,
    acquireSaveSlot,
    releaseSaveSlot,
  ]);

  /**
   * Adds existing images from the device gallery. Multi-select, so a batch can
   * be attached in one pass; each is saved through the same path as a capture.
   *
   * Request Photo Library access on iOS only: Capacitor's pickImages still
   * requires it (and rejects Limited access). Android Photo Picker and the
   * web file input grant access per selection and must not be blocked by a
   * library permission deny.
   */
  const pickFromGallery = useCallback(async () => {
    if (pickerInFlightRef.current) return;
    if (savesInFlightRef.current >= MAX_PARALLEL_SAVES) return;

    beginPicker();
    try {
      const photosAccess = await ensureIosPhotosAccess();
      if (photosAccess) {
        setNoPhotosPermission(photosAccess);
        return;
      }
      setNoPhotosPermission(null);

      // quality/width are honoured on iOS/Android only. The web plugin
      // returns the original File via createObjectURL — see
      // preparePhotoBlobForStorage, which re-encodes after fetch.
      const {photos} = await Camera.pickImages({
        quality: IMAGE_QUALITY_0_100,
        width: MAX_IMAGE_WIDTH,
        correctOrientation: true,
        limit: MAX_GALLERY_BATCH,
      });

      if (photos.length === 0) return;

      // Defensive cap: some platforms/versions ignore `limit`. Trim here so
      // we never process more than MAX_GALLERY_BATCH regardless of platform.
      const overLimit = photos.length > MAX_GALLERY_BATCH;
      const selected = overLimit ? photos.slice(0, MAX_GALLERY_BATCH) : photos;

      setSaveError(
        overLimit
          ? `You can add up to ${MAX_GALLERY_BATCH} photos at once — only the first ${MAX_GALLERY_BATCH} will be added.`
          : null
      );

      // Preview the whole selection first so every thumbnail appears at once,
      // rather than trickling in behind each write. If a fetch fails mid-batch
      // we roll back the previews already added so nothing gets stuck.
      const pending: {tempId: string; photoBlob: Blob; format: string}[] = [];
      try {
        for (const photo of selected) {
          const response = await fetch(photo.webPath);
          const photoBlob = await response.blob();
          // Web: downscale / JPEG-compress here. Native: passthrough.
          const prepared = await preparePhotoBlobForStorage(
            photoBlob,
            photo.format
          );
          pending.push({
            tempId: addPendingPreview(prepared.photoBlob),
            photoBlob: prepared.photoBlob,
            format: prepared.format,
          });
        }
      } catch (err) {
        for (const item of pending) {
          removePendingPhoto(item.tempId);
        }
        throw err;
      }

      // Parallel writes up to MAX_PARALLEL_SAVES, shared with camera saves.
      // Start every store (they acquire slots) before releasing the picker so
      // the form lock stays held. No `path` is passed, so native gallery
      // images keep their original EXIF location. Web re-encoding strips EXIF
      // (see preparePhotoBlobForStorage). Per-item try/catch so one bad write
      // doesn't strand the remaining previews on "Saving..." — storePhoto
      // already drops its own preview on failure, we just tally and continue.
      let failures = 0;
      const storePromises = pending.map(async item => {
        await acquireSaveSlot();
        try {
          await storePhoto(item);
        } catch (err) {
          failures++;
          logError(new Error('Failed to save gallery photo:'), {error: err});
        } finally {
          releaseSaveSlot();
        }
      });
      endPicker();
      await Promise.all(storePromises);
      if (failures > 0) {
        const plural = pending.length === 1 ? '' : 's';
        setSaveError(
          `Could not save ${failures} of ${pending.length} photo${plural}. Please try again.`
        );
      }
    } catch (err: unknown) {
      if (isCancellation(err)) return;
      if (isPhotosAccessDenied(err)) {
        setNoPhotosPermission('denied');
        return;
      }
      logError(new Error('Failed to add photos from gallery:'), {error: err});
      setSaveError('Could not add photos from your gallery. Please try again.');
    } finally {
      if (pickerInFlightRef.current) {
        endPicker();
      }
    }
  }, [
    addPendingPreview,
    removePendingPhoto,
    storePhoto,
    beginPicker,
    endPicker,
    acquireSaveSlot,
    releaseSaveSlot,
  ]);

  /**
   * Deletes a photo by attachment id. Index-based delete is unsafe: a
   * gallery batch save prepends to attachments and would shift every index
   * if a confirm dialog were already open.
   */
  const handleDelete = useCallback(
    (attachmentId: string) => {
      if (pickerInFlightRef.current) return;
      removeAttachment({attachmentId});
      // Filter the latest list. A snapshot of props.state.value is stale
      // while parallel storePhoto calls are appending ids, and writing that
      // snapshot back drops ids that just finished saving.
      props.setFieldData((prev: string[] | undefined) =>
        (prev ?? []).filter(v => v !== attachmentId)
      );
    },
    [removeAttachment, props.setFieldData]
  );

  // Determine if we have any photos to show (either pending or loaded)
  const hasAnyPhotos =
    (state.value?.attachments?.length ?? 0) > 0 || pendingPhotos.size > 0;

  const atSaveCapacity = savesInFlight >= MAX_PARALLEL_SAVES;
  const actionsDisabled = pickerInFlight || atSaveCapacity;
  const actionsDisabledReason = atSaveCapacity
    ? `Up to ${MAX_PARALLEL_SAVES} photos can save at once — wait for one to finish.`
    : undefined;

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
      errors={props.state.meta.errors as unknown as string[]}
    >
      <Box sx={{width: '100%'}}>
        {/* Attachment Download Warning */}
        {loadedPhotos.some(q => q.isError) && (
          <Alert severity="warning" sx={{mb: 2}}>
            Some photos could not be loaded. To download attachments, enable
            attachment download in Settings.
          </Alert>
        )}

        {/* Save Error - shown when a capture or gallery pick failed to persist */}
        {saveError && (
          <Alert
            severity="error"
            sx={{mb: 2}}
            onClose={() => setSaveError(null)}
          >
            {saveError}
          </Alert>
        )}

        {/* Camera Permission Warning */}
        {noPermission && <CameraPermissionIssue appName={appName} />}

        {noPhotosPermission && (
          <PhotosPermissionIssue
            appName={appName}
            access={noPhotosPermission}
          />
        )}

        {/* Photo Display */}
        {!hasAnyPhotos ? (
          <EmptyState
            onAddPhoto={takePhoto}
            onPickFromGallery={pickFromGallery}
            disabled={disabled}
            actionsDisabled={actionsDisabled}
            actionsDisabledReason={actionsDisabledReason}
          />
        ) : (
          <PhotoGallery
            photos={loadedPhotos}
            pendingPhotos={pendingPhotos}
            onDelete={handleDelete}
            onAddPhoto={takePhoto}
            onPickFromGallery={pickFromGallery}
            disabled={disabled}
            actionsDisabled={actionsDisabled}
            actionsDisabledReason={actionsDisabledReason}
            deleteDisabled={pickerInFlight}
          />
        )}
      </Box>
    </FieldWrapper>
  );
};

// ============================================================================
// Main Export Component
// ============================================================================

/**
 * TakePhoto field component - routes to preview or full mode based on context.
 */
export const TakePhoto: React.FC<TakePhotoFieldProps> = props => {
  const {config: context} = props;

  if (context.mode === 'preview') {
    return <TakePhotoPreview {...props} />;
  } else if (context.mode === 'full') {
    const fullConfig = props.config as FullFormConfig;
    return <TakePhotoFull {...{...props, config: fullConfig}} />;
  }

  return null;
};

// ============================================================================
// Field Registration
// ============================================================================

/**
 * Field specification for registering the TakePhoto component with the form system.
 */
export const takePhotoFieldSpec: FieldInfo = {
  namespace: 'faims-custom',
  name: 'TakePhoto',
  returns: 'faims-attachment::Files',
  component: TakePhoto,
  fieldPropsSchema: takePhotoPropsSchema,
  fieldDataSchemaFunction: takePhotoValueSchema,
  isCompleteFunction: takePhotoIsComplete,
  view: {
    component: TakePhotoRender,
    config: {},
    // For attachments, we need to be more careful about this - this means that
    // we still give this renderer the chance to render a field even if the
    // renderer thinks it is null
    attributes: {bypassNullChecks: true},
  },
};
