import {Exif} from '@capacitor-community/exif';
import {Camera, CameraResultType, Photo} from '@capacitor/camera';
import {Capacitor} from '@capacitor/core';
import {Geolocation} from '@capacitor/geolocation';
import {logError} from '@faims3/data-model';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import SyncIcon from '@mui/icons-material/Sync';
import {Alert, Box, Paper, Typography, useTheme} from '@mui/material';
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
import {CameraPermissionIssue} from '../../../components/PermissionAlerts';
import {FullFormConfig} from '../../../formModule/formManagers/types';
import {
  BaseFieldPropsSchema,
  FormFieldContextProps,
} from '../../../formModule/types';
import {
  LoadedPhoto,
  useAttachments,
  useAttachmentsResult,
} from '../../../hooks/useAttachment';
import {TakePhotoRender} from '../../../rendering/fields/view/specialised/TakePhoto';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';

// Reduce image size by scaling down capacitor quality
const IMAGE_QUALITY_0_100 = 60;
const MAX_IMAGE_WIDTH = 1920;

// Types & Schema
// ============================================================================

const takePhotoPropsSchema = BaseFieldPropsSchema.extend({});
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

/**
 * Empty state component displayed when no photos have been captured yet.
 * Shows a call-to-action button to take the first photo.
 */
const EmptyState: React.FC<{
  onAddPhoto: () => void;
  disabled: boolean;
}> = ({onAddPhoto, disabled}) => {
  const theme = useTheme();

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
      <CameraAltIcon sx={{fontSize: 48, color: 'text.secondary', mb: 2}} />
      <Typography variant="h6" gutterBottom>
        No Photos Yet
      </Typography>
      <Button
        variant="contained"
        color="primary"
        onClick={onAddPhoto}
        disabled={disabled}
        startIcon={<CameraAltIcon />}
      >
        Take First Photo
      </Button>
    </Paper>
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
}> = ({data, onDelete, onClick}) => {
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
 * Displays a sync indicator overlay to show the photo is being processed.
 */
const PendingPhotoItem: React.FC<{
  url: string;
  onClick: () => void;
}> = ({url, onClick}) => {
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
        {/* Saving indicator overlay */}
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
      </Box>
    </ImageItemContainer>
  );
};

/**
 * Full-screen lightbox dialog for viewing photos at full size.
 * Opens when a user clicks on a photo thumbnail.
 */
const Lightbox: React.FC<{
  url: string;
  onClose: () => void;
}> = ({url, onClose}) => {
  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
        },
      }}
    >
      <DialogContent sx={{p: 0, display: 'flex', justifyContent: 'center'}}>
        <Box
          component="img"
          src={url}
          alt="Full size preview"
          sx={{
            maxWidth: '100%',
            maxHeight: '90vh',
            objectFit: 'contain',
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

/**
 * Unified photo entry for the gallery - can be either a loaded photo or a pending one.
 */
type GalleryPhoto =
  | {
      type: 'loaded';
      photo: useAttachmentsResult[number];
      originalIndex: number;
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
  onDelete: (index: number) => void;
  onAddPhoto: () => void;
  disabled: boolean;
}> = ({photos, pendingPhotos, onDelete, onAddPhoto, disabled}) => {
  const theme = useTheme();

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<number | null>(null);

  // Lightbox state - now stores URL directly to support both loaded and pending
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Handlers
  const handleDeleteClick = (index: number) => {
    setPhotoToDelete(index);
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

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      // Skip if this photo is still showing as pending
      if (photo.data && pendingAttachmentIds.has(photo.data.id)) {
        continue;
      }
      result.push({type: 'loaded', photo, originalIndex: i});
    }

    return result;
  }, [photos, pendingPhotos]);

  return (
    <>
      <Box sx={{width: '100%'}}>
        <Box
          sx={{
            display: 'grid',
            gap: theme.spacing(1),
            padding: theme.spacing(1),
            gridTemplateColumns: {
              xs: 'repeat(2, 1fr)',
              sm: 'repeat(4, 1fr)',
              md: 'repeat(6, 1fr)',
              lg: 'repeat(8, 1fr)',
            },
            width: '100%',
          }}
        >
          {/* Add Photo Button */}
          {!disabled && (
            <ImageItemContainer>
              <Paper
                sx={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                onClick={onAddPhoto}
              >
                <AddCircleIcon
                  sx={{fontSize: 48, color: theme.palette.primary.main}}
                />
              </Paper>
            </ImageItemContainer>
          )}

          {/* Photo Grid - unified pending + loaded */}
          {galleryPhotos.map((entry, displayIndex) => {
            if (entry.type === 'pending') {
              return (
                <PendingPhotoItem
                  key={`pending-${entry.tempId}`}
                  url={entry.pending.url}
                  onClick={() => setLightboxUrl(entry.pending.url)}
                />
              );
            }

            // Loaded photo
            const {photo, originalIndex} = entry;

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
                onDelete={() => handleDeleteClick(originalIndex)}
                onClick={() => setLightboxUrl(photo.data.url)}
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
            sx={{borderRadius: theme.spacing(1), ml: 2}}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Lightbox */}
      {lightboxUrl && (
        <Lightbox url={lightboxUrl} onClose={handleLightboxClose} />
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
    label,
    helperText,
    required,
    advancedHelperText,
    disabled = false,
    state,
    addAttachment,
    removeAttachment,
    config: context,
  } = props;

  const appName = props.config.appName;
  const [noPermission, setNoPermission] = useState(false);

  // Optimistic photo display state
  // Key is a temporary ID, value contains the blob URL and eventual attachment ID
  const [pendingPhotos, setPendingPhotos] = useState<Map<string, PendingPhoto>>(
    new Map()
  );

  // Track URLs that need cleanup on unmount
  const pendingUrlsRef = useRef<Set<string>>(new Set());

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

  /**
   * Captures a photo from the device camera.
   * On native platforms, attempts to add geolocation EXIF data.
   * On web, uses base64 encoding for photo transfer.
   *
   * Uses optimistic updates to show the photo immediately while
   * the database write happens in the background.
   */
  const takePhoto = useCallback(async () => {
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
        promptLabelHeader: 'Take or select a photo',
      });

      // Generate temporary ID for optimistic display
      const tempId = `temp-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

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

      // Setup optimistic preview
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

      if (!isWeb) {
        // Native: attempt to add geolocation EXIF data
        try {
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });

          if (position && photoResult.path) {
            await Exif.setCoordinates({
              pathToImage: photoResult.path,
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          }
        } catch (e) {
          console.warn('Could not add geolocation to photo:', e);
        }
      }

      // Now do the async storage
      const newId = await addAttachment({
        // Blob attachments are faster - especially on native
        blob: photoBlob,
        contentType: `image/${photoResult.format}`,
        type: 'photo',
        fileFormat: photoResult.format,
      });

      // Update pending photo with the real attachment ID
      // This allows the cleanup effect to know when to remove it
      setPendingPhotos(current => {
        const updated = new Map(current);
        const pending = updated.get(tempId);
        if (pending) {
          updated.set(tempId, {...pending, attachmentId: newId});
        }
        return updated;
      });

      // Update field value
      const currentData = props.state.value?.data as string[] | undefined;
      props.setFieldData([...(currentData ?? []), newId]);
    } catch (err: any) {
      logError(err);
      console.error('Failed to capture photo:', err);
    }
  }, [state.value, addAttachment, context]);

  /**
   * Deletes a photo at the specified index from the field's attachments.
   */
  const handleDelete = useCallback(
    (index: number) => {
      const currentAttachments = state.value?.attachments || [];
      const targetId = currentAttachments[index].attachmentId;
      removeAttachment({attachmentId: targetId});
      const currentData = props.state.value?.data as string[] | undefined;
      props.setFieldData((currentData ?? []).filter(v => v !== targetId));
    },
    [state.value, removeAttachment]
  );

  // Determine if we have any photos to show (either pending or loaded)
  const hasAnyPhotos = loadedPhotos.length > 0 || pendingPhotos.size > 0;

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

        {/* Camera Permission Warning */}
        {noPermission && <CameraPermissionIssue appName={appName} />}

        {/* Photo Display */}
        {!hasAnyPhotos ? (
          <EmptyState onAddPhoto={takePhoto} disabled={disabled} />
        ) : (
          <PhotoGallery
            photos={loadedPhotos}
            pendingPhotos={pendingPhotos}
            onDelete={handleDelete}
            onAddPhoto={takePhoto}
            disabled={disabled}
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
  fieldDataSchemaFunction: (props: TakePhotoProps) => {
    // check there is at least one entry
    let base: z.ZodType<any> = z.array(z.string());
    if (props.required) {
      base = base.refine(val => (val ?? []).length > 0, {
        message: 'At least one attachment is required',
      });
    }

    return base;
  },
  view: {
    component: TakePhotoRender,
    config: {},
    // For attachments, we need to be more careful about this - this means that
    // we still give this renderer the chance to render a field even if the
    // renderer thinks it is null
    attributes: {bypassNullChecks: true},
  },
};
