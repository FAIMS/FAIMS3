import {Exif} from '@capacitor-community/exif';
import {Camera, CameraResultType, Photo} from '@capacitor/camera';
import {Capacitor} from '@capacitor/core';
import {Geolocation} from '@capacitor/geolocation';
import {
  FaimsAttachments,
  IAttachmentService,
  logError,
} from '@faims3/data-model';
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
import {useQuery} from '@tanstack/react-query';
import {Buffer} from 'buffer';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {z} from 'zod';
import {FullFormContext} from '../../../formModule';
import {
  BaseFieldPropsSchema,
  FormFieldContextProps,
} from '../../../formModule/types';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';

const takePhotoPropsSchema = BaseFieldPropsSchema.extend({});
type TakePhotoProps = z.infer<typeof takePhotoPropsSchema>;
type TakePhotoFieldProps = TakePhotoProps & FormFieldContextProps;

/**
 * Represents a photo that has been stored as an attachment
 */
interface StoredPhoto {
  attachmentId: string;
}

/**
 * Query key factory for attachment queries
 */
const attachmentKeys = {
  all: ['attachments'] as const,
  attachment: (id: string) => [...attachmentKeys.all, id] as const,
};

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
  const theme = useTheme();

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
 * Custom hook to fetch attachment using TanStack Query
 */
const useAttachment = (
  attachmentId: string,
  attachmentService: IAttachmentService
) => {
  return useQuery({
    queryKey: attachmentKeys.attachment(attachmentId),
    queryFn: async () => {
      const result = await attachmentService.loadAttachmentAsBlob({
        identifier: {id: attachmentId},
      });
      // Create object URL for display
      const url = URL.createObjectURL(result.blob);
      return {blob: result.blob, url};
    },
    // Keep data in cache for 10 minutes
    staleTime: 10 * 60 * 1000,
    // Cache for 30 minutes
    gcTime: 30 * 60 * 1000,
    // Retry 3 times with exponential backoff
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Continue retrying even when offline
    networkMode: 'always',
  });
};

/**
 * Displays a single photo in the gallery with loading state
 */
const PhotoItem: React.FC<{
  photo: StoredPhoto;
  index: number;
  onDelete: () => void;
  onClick: () => void;
  disabled: boolean;
  attachmentService: IAttachmentService;
  onLoadError: () => void;
}> = ({
  photo,
  index,
  onDelete,
  onClick,
  disabled,
  attachmentService,
  onLoadError,
}) => {
  const theme = useTheme();

  // Use TanStack Query to fetch attachment
  const {data, isLoading, isError, error} = useAttachment(
    photo.attachmentId,
    attachmentService
  );

  // Track error state for parent component
  useEffect(() => {
    if (isError) {
      console.error('Failed to load attachment:', error);
      onLoadError();
    }
  }, [isError, error, onLoadError]);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (data?.url) {
        URL.revokeObjectURL(data.url);
      }
    };
  }, [data?.url]);

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
        {isError ? (
          <UnavailableImagePlaceholder />
        ) : isLoading ? (
          <ImageIcon sx={{fontSize: 48, color: 'text.secondary'}} />
        ) : data?.url ? (
          <>
            <Box
              component="img"
              src={data.url}
              onClick={onClick}
              alt={`Photo ${index + 1}`}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                cursor: 'pointer',
              }}
            />
            {!disabled && (
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
            )}
          </>
        ) : null}
      </Box>
    </ImageListItem>
  );
};

/**
 * Displays a grid of photos with add and delete functionality
 */
const PhotoGallery: React.FC<{
  photos: StoredPhoto[];
  onDelete: (index: number) => void;
  onAddPhoto: () => void;
  disabled: boolean;
  attachmentService: IAttachmentService;
  onPhotoLoadError: () => void;
}> = ({
  photos,
  onDelete,
  onAddPhoto,
  disabled,
  attachmentService,
  onPhotoLoadError,
}) => {
  const theme = useTheme();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Use TanStack Query for lightbox image loading
  const {data: lightboxData} = useQuery({
    queryKey: attachmentKeys.attachment(lightboxImage || ''),
    queryFn: async () => {
      if (!lightboxImage) return null;
      const result = await attachmentService.loadAttachmentAsBlob({
        identifier: {id: lightboxImage},
      });
      const url = URL.createObjectURL(result.blob);
      return {blob: result.blob, url};
    },
    enabled: !!lightboxImage && lightboxOpen,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    networkMode: 'offlineFirst',
  });

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
    if (lightboxData?.url) {
      URL.revokeObjectURL(lightboxData.url);
    }
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

            return (
              <PhotoItem
                key={photo.attachmentId}
                photo={photo}
                index={displayIndex}
                onDelete={() => handleDeleteClick(originalIndex)}
                onClick={() => handleImageClick(photo.attachmentId)}
                disabled={disabled}
                attachmentService={attachmentService}
                onLoadError={onPhotoLoadError}
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

      {/* Image Lightbox */}
      <Dialog
        open={lightboxOpen}
        onClose={handleLightboxClose}
        maxWidth="lg"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
          },
        }}
      >
        <DialogContent sx={{p: 0, display: 'flex', justifyContent: 'center'}}>
          {lightboxData?.url && (
            <Box
              component="img"
              src={lightboxData.url}
              alt="Full size preview"
              sx={{
                maxWidth: '100%',
                maxHeight: '90vh',
                objectFit: 'contain',
              }}
            />
          )}
        </DialogContent>
      </Dialog>
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
  const [hasLoadErrors, setHasLoadErrors] = useState(false);

  // Get attachment service (guaranteed to exist in full mode)
  const attachmentService = context.attachmentEngine();

  // Get current photos from field state
  const photos: StoredPhoto[] = (state.value?.attachments || []).map(att => ({
    attachmentId: att.attachmentId,
  }));

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

  const handlePhotoLoadError = useCallback(() => {
    setHasLoadErrors(true);
  }, []);

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
    >
      <Box sx={{width: '100%'}}>
        {/* Show download banner only if we have actual load errors */}
        {hasLoadErrors && (
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
        {photos.length === 0 ? (
          <EmptyState onAddPhoto={takePhoto} disabled={disabled} />
        ) : (
          <PhotoGallery
            photos={photos}
            onDelete={handleDelete}
            onAddPhoto={takePhoto}
            disabled={disabled}
            attachmentService={attachmentService}
            onPhotoLoadError={handlePhotoLoadError}
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
    // Full mode
    return (
      <TakePhotoFull
        // Type hackery
        {...{...props, context: props.context as FullFormContext}}
      />
    );
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
