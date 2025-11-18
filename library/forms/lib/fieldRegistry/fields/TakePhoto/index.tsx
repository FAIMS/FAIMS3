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
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: TakePhoto.tsx
 * Description: Photo capture component with attachment management
 */

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
import {Alert, Box, Link, Paper, Typography, useTheme} from '@mui/material';
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
 * Represents a photo that has been captured but not yet stored
 */
interface LocalPhoto {
  blob: Blob;
  objectUrl: string;
}

/**
 * Represents a photo that has been stored as an attachment
 */
interface StoredPhoto {
  attachmentId: string;
}

/**
 * Union type representing either a local or stored photo
 */
type PhotoItem = LocalPhoto | StoredPhoto;

/**
 * Type guard to check if a photo is stored
 */
function isStoredPhoto(photo: PhotoItem): photo is StoredPhoto {
  return 'attachmentId' in photo;
}

/**
 * Type guard to check if a photo is local
 */
function isLocalPhoto(photo: PhotoItem): photo is LocalPhoto {
  return 'blob' in photo && 'objectUrl' in photo;
}

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
 * Displays a placeholder for photos that haven't been downloaded yet
 */
const UnavailableImagePlaceholder: React.FC<{
  //serverId?: string;
  //projectId: string;
}> = (
  {
    //serverId,
    // projectId
  }
) => {
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
        Attachment not synced
      </Typography>
      {
        <Typography
          variant="caption"
          sx={{
            color: 'rgba(0, 0, 0, 0.5)',
            textAlign: 'center',
          }}
        >
          Enable download in{' '}
          <Link
            component="button"
            onClick={e => {
              e.stopPropagation();
              // TODO get this working again
              // window.location.href = `${ROUTES.getNotebookRoute({serverId, projectId})}?${ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE_TAB_Q}=settings`;
            }}
            sx={{
              verticalAlign: 'baseline',
            }}
          >
            Settings
          </Link>
        </Typography>
      }
    </Paper>
  );
};

/**
 * Displays a single photo in the gallery with loading state
 */
const PhotoItem: React.FC<{
  photo: PhotoItem;
  index: number;
  onDelete: () => void;
  onClick: () => void;
  disabled: boolean;
  attachmentService: IAttachmentService;
}> = ({photo, index, onDelete, onClick, disabled, attachmentService}) => {
  const theme = useTheme();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Load stored photos
  React.useEffect(() => {
    if (isStoredPhoto(photo)) {
      let mounted = true;

      attachmentService
        .loadAttachmentAsBlob({
          identifier: {id: photo.attachmentId},
        })
        .then(result => {
          if (mounted) {
            const url = URL.createObjectURL(result.blob);
            setImageUrl(url);
          }
        })
        .catch(err => {
          console.error('Failed to load attachment:', err);
          if (mounted) {
            setLoadError(true);
          }
        });

      return () => {
        mounted = false;
        if (imageUrl) {
          URL.revokeObjectURL(imageUrl);
        }
      };
    } else {
      // Local photo - use the existing object URL
      setImageUrl(photo.objectUrl);
    }
  }, [photo, attachmentService]);

  // Cleanup object URLs on unmount
  React.useEffect(() => {
    return () => {
      if (imageUrl && isLocalPhoto(photo)) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl, photo]);

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
        {loadError ? (
          <UnavailableImagePlaceholder
          //serverId={serverId}
          //projectId={projectId}
          />
        ) : imageUrl ? (
          <>
            <Box
              component="img"
              src={imageUrl}
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
        ) : (
          <ImageIcon sx={{fontSize: 48, color: 'text.secondary'}} />
        )}
      </Box>
    </ImageListItem>
  );
};

/**
 * Displays a grid of photos with add and delete functionality
 */
const PhotoGallery: React.FC<{
  photos: PhotoItem[];
  onDelete: (index: number) => void;
  onAddPhoto: () => void;
  disabled: boolean;
  attachmentService: IAttachmentService;
}> = ({photos, onDelete, onAddPhoto, disabled, attachmentService}) => {
  const theme = useTheme();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

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

  const handleImageClick = (url: string) => {
    setLightboxImage(url);
    setLightboxOpen(true);
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
                key={originalIndex}
                photo={photo}
                index={displayIndex}
                onDelete={() => handleDeleteClick(originalIndex)}
                onClick={() => {
                  if (isLocalPhoto(photo)) {
                    handleImageClick(photo.objectUrl);
                  } else {
                    // For stored photos, we'll need to fetch them
                    attachmentService
                      .loadAttachmentAsBlob({
                        identifier: {id: photo.attachmentId},
                      })
                      .then(result => {
                        const url = URL.createObjectURL(result.blob);
                        handleImageClick(url);
                      })
                      .catch(err => {
                        console.error(
                          'Failed to load image for lightbox:',
                          err
                        );
                      });
                  }
                }}
                disabled={disabled}
                attachmentService={attachmentService}
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
        onClose={() => {
          setLightboxOpen(false);
          if (lightboxImage) {
            // Only revoke if it's a temporary URL we created
            const isTemporary = displayPhotos.some(
              p => isStoredPhoto(p) // Stored photos create temporary URLs
            );
            if (isTemporary) {
              URL.revokeObjectURL(lightboxImage);
            }
          }
          setLightboxImage(null);
        }}
        maxWidth="lg"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
          },
        }}
      >
        <DialogContent sx={{p: 0, display: 'flex', justifyContent: 'center'}}>
          {lightboxImage && (
            <Box
              component="img"
              src={lightboxImage}
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

/**
 * Main TakePhoto component
 * Handles photo capture, storage, and display using the attachment service
 */
export const TakePhoto: React.FC<TakePhotoFieldProps> = props => {
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

  // Get context info
  const attachmentService =
    context.mode === 'full' ? context.attachmentEngine() : null;

  // Get current photos from field state
  const photos: PhotoItem[] = (state.value?.attachments || []).map(att => ({
    attachmentId: att.attachmentId,
  }));

  /**
   * Captures a photo from the device camera with geolocation on native platforms
   */
  const takePhoto = useCallback(async () => {
    if (!attachmentService) {
      console.error('Attachment service not available');
      return;
    }

    try {
      const isWeb = Capacitor.getPlatform() === 'web';

      if (isWeb) {
        // Web platform: check camera permission
        const permission = await navigator.permissions.query({
          name: 'camera' as PermissionName,
        });
        if (permission.state === 'denied') {
          setNoPermission(true);
          return;
        }
      } else {
        // Native platform: request camera permission
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
        // Convert base64 to blob
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

      // Store the attachment immediately
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
            recordId:
              context.mode === 'full' ? context.recordInformation.recordId : '',
            revisionId:
              context.mode === 'full'
                ? context.recordInformation.revisionId
                : '',
            created: timestamp,
            createdBy: context.mode === 'full' ? context.user : '',
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
      const newAttachments = currentAttachments.filter(
        (_: any, i: number) => i !== index
      );
      setFieldAttachment(newAttachments);
    },
    [state.value, setFieldAttachment]
  );

  // Check if we're in a context where attachments might not be downloaded
  const hasUndownloadedWarning = photos.length > 0 && context.mode === 'full';

  if (!attachmentService) {
    return (
      <FieldWrapper
        heading={label}
        subheading={helperText}
        required={required}
        advancedHelperText={advancedHelperText}
      >
        <Alert severity="error">
          Photo capture is not available in this context
        </Alert>
      </FieldWrapper>
    );
  }

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
    >
      <Box sx={{width: '100%'}}>
        {/* Download Banner */}
        {hasUndownloadedWarning && (
          <Alert severity="info" sx={{mb: 2}}>
            To download existing photos, please go to the{' '}
            <Link
              onClick={() => {
                // TODO fix navigation
                // navigate(
                //   `${ROUTES.getNotebookRoute({serverId, projectId})}?${ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE_TAB_Q}=settings`
                // );
              }}
              sx={{cursor: 'pointer'}}
            >
              Settings Tab
            </Link>{' '}
            and enable attachment download.
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
          />
        )}
        {/* Permission Issue Alert
          TODO : include <LocationPermissionIssue /> back again 
        */}
        {noPermission && null}
        {
          // <LocationPermissionIssue />
        }
      </Box>
    </FieldWrapper>
  );
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
