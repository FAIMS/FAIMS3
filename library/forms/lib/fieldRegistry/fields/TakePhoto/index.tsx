import {Exif} from '@capacitor-community/exif';
import {Camera, CameraResultType, Photo} from '@capacitor/camera';
import {Capacitor} from '@capacitor/core';
import {Geolocation} from '@capacitor/geolocation';
import {FaimsAttachments, logError} from '@faims3/data-model';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
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
import React, {useCallback, useMemo, useState} from 'react';
import {z} from 'zod';
import {FullFormContext} from '../../../formModule';
import {
  BaseFieldPropsSchema,
  FormFieldContextProps,
} from '../../../formModule/types';
import {
  LoadedPhoto,
  useAttachments,
  useAttachmentsResult,
} from '../../../hooks/useAttachment';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';

const takePhotoPropsSchema = BaseFieldPropsSchema.extend({});
type TakePhotoProps = z.infer<typeof takePhotoPropsSchema>;
type TakePhotoFieldProps = TakePhotoProps & FormFieldContextProps;

/**
 * Converts a base64 encoded image to a Blob object
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

/**
 * Preview mode component - shows placeholder for non-interactive display
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

/**
 * Displays a placeholder component when no photos are present
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
 * Displays a placeholder for photos that failed to load
 */
const UnavailableImagePlaceholder: React.FC = () => {
  return (
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
        p: 2,
        cursor: 'default',
      }}
    >
      <CloudOffIcon
        sx={{
          fontSize: 48,
          color: 'rgba(0, 0, 0, 0.3)',
        }}
      />
      <Typography
        variant="body2"
        sx={{
          color: 'rgba(0, 0, 0, 0.6)',
          textAlign: 'center',
        }}
      >
        Attachment not available
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: 'rgba(0, 0, 0, 0.5)',
          textAlign: 'center',
        }}
      >
        Enable download in Settings
      </Typography>
    </Paper>
  );
};

/**
 * Displays a single photo in the gallery.
 * Photo must be loaded/managed by parent component.
 */
const PhotoItem: React.FC<{
  data: LoadedPhoto;
  onDelete: () => void;
  onClick: () => void;
}> = ({data, onDelete, onClick}) => {
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
        <>
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
            sx={{
              background: 'rgba(0, 0, 0, 0.7)',
            }}
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
        </>
      </Box>
    </ImageListItem>
  );
};

/**
 * Lightbox bigger dialog.
 *
 * @param image The attachment ID to show
 * @param onClose Close handler
 */
const Lightbox: React.FC<{
  onClose: () => void;
  data: LoadedPhoto;
}> = ({data, onClose: close}) => {
  return (
    <Dialog
      open={true}
      onClose={close}
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
          src={data.url}
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
 * Displays a grid of photos with add and delete functionality
 */
const PhotoGallery: React.FC<{
  photos: useAttachmentsResult;
  onDelete: (index: number) => void;
  onAddPhoto: () => void;
  disabled: boolean;
}> = ({photos, onDelete, onAddPhoto, disabled}) => {
  const theme = useTheme();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<number | null>(null);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const lightboxData = lightboxImage
    ? photos.find(p => p.data?.id === lightboxImage)
    : undefined;

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

  const handleImageClick = (attachmentId: string) => {
    setLightboxImage(attachmentId);
    setLightboxOpen(true);
  };

  const handleLightboxClose = () => {
    setLightboxOpen(false);
    setLightboxImage(null);
  };

  // Reverse photos to show newest first
  const displayPhotos = useMemo(() => [...photos].reverse(), [photos]);

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
            </ImageListItem>
          )}

          {/* Photo Gallery */}
          {displayPhotos.map((photo, displayIndex) => {
            // Calculate original index (before reversal)
            const originalIndex = photos.length - 1 - displayIndex;

            if (photo.isLoading)
              return <ImageIcon sx={{fontSize: 48, color: 'text.secondary'}} />;

            if (photo.isError || !photo.data) {
              return <UnavailableImagePlaceholder key={displayIndex} />;
            }

            return (
              <PhotoItem
                data={photo.data}
                onDelete={() => handleDeleteClick(originalIndex)}
                onClick={() => handleImageClick(photo.data.id)}
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
      {lightboxOpen && lightboxImage && lightboxData?.data && (
        <Lightbox onClose={handleLightboxClose} data={lightboxData.data} />
      )}
    </>
  );
};

// Indicating that we have full context here
interface FullTakePhotoFieldProps extends TakePhotoFieldProps {
  context: FullFormContext;
}

/**
 * Main TakePhoto component (Full mode)
 * Handles photo capture, storage, and display using the attachment service
 */
const TakePhotoFull: React.FC<FullTakePhotoFieldProps> = props => {
  const {
    label,
    helperText,
    required,
    advancedHelperText,
    disabled = false,
    state,
    setFieldAttachment,
    context,
  } = props;

  const [noPermission, setNoPermission] = useState(false);

  // Get attachment service (guaranteed to exist in full mode)
  const attachmentService = context.attachmentEngine();

  // Query for all attachments
  const loadedPhotos = useAttachments(
    // Map att -> att ID
    (state.value?.attachments || []).map(att => att.attachmentId),
    // Pass in service
    attachmentService
  );

  /**
   * Captures a photo from the device camera with geolocation on native platforms
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
        quality: 90,
        allowEditing: false,
        resultType: isWeb ? CameraResultType.Base64 : CameraResultType.Uri,
        correctOrientation: true,
        promptLabelHeader: 'Take or select a photo',
      });

      let photoBlob: Blob;

      if (isWeb) {
        photoBlob = await base64ImageToBlob(photoResult);
      } else {
        // Native: add geolocation EXIF data if possible
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

        // Fetch the photo as a blob
        if (!photoResult.webPath) {
          throw new Error('Photo webPath is undefined');
        }
        const response = await fetch(photoResult.webPath);
        photoBlob = await response.blob();
      }

      // Store the attachment
      const timestamp = new Date().toISOString();
      const filename = `photo_${timestamp}.${photoResult.format}`;

      const result = await attachmentService.storeAttachmentFromBlob({
        blob: photoBlob,
        metadata: {
          attachmentDetails: {
            filename,
            contentType: `image/${photoResult.format}`,
          },
          recordContext: {
            recordId: context.recordInformation.recordId,
            revisionId: context.recordInformation.revisionId,
            created: timestamp,
            createdBy: context.user,
          },
        },
      });

      // Update field attachments
      const currentAttachments: FaimsAttachments =
        state.value?.attachments || [];
      const newAttachments: FaimsAttachments = [
        ...currentAttachments,
        {
          attachmentId: result.identifier.id,
          filename: result.metadata.filename,
          fileType: result.metadata.contentType,
        },
      ];

      setFieldAttachment(newAttachments);
    } catch (err: any) {
      logError(err);
      console.error('Failed to capture photo:', err);
    }
  }, [attachmentService, state.value, setFieldAttachment, context]);

  /**
   * Deletes a photo at the specified index
   */
  const handleDelete = useCallback(
    (index: number) => {
      const currentAttachments = state.value?.attachments || [];

      // Remove from attachments
      const newAttachments = currentAttachments.filter(
        (_: any, i: number) => i !== index
      );
      setFieldAttachment(newAttachments);
    },
    [state.value, setFieldAttachment]
  );

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
    >
      <Box sx={{width: '100%'}}>
        {/* Show download banner only if we have actual load errors */}
        {loadedPhotos.some(q => q.isError) && (
          <Alert severity="warning" sx={{mb: 2}}>
            Some photos could not be loaded. To download attachments, enable
            attachment download in Settings.
          </Alert>
        )}

        {/* Permission Issue Alert */}
        {noPermission && (
          <Alert severity="error" sx={{mb: 2}}>
            Camera permission is required to take photos. Please enable camera
            access in your device settings.
          </Alert>
        )}

        {/* Photo Display */}
        {loadedPhotos.length === 0 ? (
          <EmptyState onAddPhoto={takePhoto} disabled={disabled} />
        ) : (
          <PhotoGallery
            photos={loadedPhotos}
            onDelete={handleDelete}
            onAddPhoto={takePhoto}
            disabled={disabled}
          />
        )}
      </Box>
    </FieldWrapper>
  );
};

/**
 * Main TakePhoto component - routes to preview or full mode
 */
export const TakePhoto: React.FC<TakePhotoFieldProps> = props => {
  const {context} = props;

  // Route to preview mode if not in full context
  if (context.mode === 'preview') {
    return <TakePhotoPreview {...props} />;
  } else if (context.mode === 'full') {
    const fullContext = props.context as FullFormContext;
    // Full mode
    return <TakePhotoFull {...{...props, context: fullContext}} />;
  }
};

/**
 * Field registration information
 */
export const takePhotoFieldSpec: FieldInfo = {
  namespace: 'faims-custom',
  name: 'TakePhoto',
  returns: 'faims-attachment::Files',
  component: TakePhoto,
  fieldSchema: takePhotoPropsSchema,
  valueSchemaFunction: (props: TakePhotoProps) => {
    let schema = z.object({
      faims_attachments: z.array(
        z.object({
          attachment_id: z.string(),
          filename: z.string(),
          contentType: z.string(),
        })
      ),
    });

    if (props.required) {
      schema = schema.refine(
        val => val.faims_attachments && val.faims_attachments.length > 0,
        {
          message: 'At least one photo is required',
        }
      );
    }

    return schema;
  },
};
