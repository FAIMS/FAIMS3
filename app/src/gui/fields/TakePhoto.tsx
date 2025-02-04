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
 * Description:
 */

import {Camera, CameraResultType, Photo} from '@capacitor/camera';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import {Capacitor} from '@capacitor/core';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import Button from '@mui/material/Button';
import {Alert, Box, Link, Paper, Typography, useTheme} from '@mui/material';
import IconButton from '@mui/material/IconButton';
import ImageListItem from '@mui/material/ImageListItem';
import ImageListItemBar from '@mui/material/ImageListItemBar';
import {FieldProps} from 'formik';
import React from 'react';
import * as ROUTES from '../../constants/routes';
import {useNavigate} from 'react-router';
import {APP_NAME, NOTEBOOK_NAME_CAPITALIZED} from '../../buildconfig';
import {logError} from '../../logging';
import FaimsAttachmentManagerDialog from '../components/ui/Faims_Attachment_Manager_Dialog';
import FieldWrapper from './fieldWrapper';

/**
 * Converts a base64 encoded image to a Blob object using fetch API instead of
 * deprecated atob
 * @param image - Photo object containing base64 string and format information
 * @returns Promise resolving to a Blob object representing the image
 * @throws Error if base64String is undefined
 */
async function base64ImageToBlob(image: Photo): Promise<Blob> {
  if (image.base64String === undefined) {
    throw Error('No photo data found');
  }

  // Convert base64 to binary using fetch API
  const response = await fetch(
    `data:image/${image.format};base64,${image.base64String}`
  );
  return await response.blob();
}

// Helper function to check if any images are undownloaded
const hasUndownloadedImages = (images: Array<any>): boolean => {
  return images.some(image => image['attachment_id'] !== undefined);
};

interface Props {
  // this should be removed but will appear in older notebooks
  helpertext?: string;
  helperText?: string;
  label?: string;
  issyncing?: string;
  isconflict?: boolean;
  required?: boolean;
}

interface ImageListProps {
  images: Array<any>;
  // if null, this indicates the image is not downloaded
  setOpen: (path: string | null) => void;
  setImages: (newFiles: Array<any>) => void;
  disabled: boolean;
  fieldName: string;
  onAddPhoto: () => void;
}

/**
 * Displays a placeholder component when no images are present
 */
const EmptyState = ({onAddPhoto}: {onAddPhoto: () => void}) => {
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
        startIcon={<CameraAltIcon />}
      >
        Take First Photo
      </Button>
    </Paper>
  );
};

/**
 * Displays a placeholder when an image is unavailable or cannot be loaded
 */
const UnavailableImage = () => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.palette.background.lightBackground,
      }}
    >
      <ImageIcon sx={{fontSize: 48, color: 'text.secondary'}} />
    </Box>
  );
};

/**
 * Displays a grid of images with add and delete functionality
 */
const ImageGallery = ({
  images,
  setOpen: setopen,
  setImages,
  disabled,
  fieldName,
  onAddPhoto,
}: ImageListProps) => {
  const theme = useTheme();
  // Handler for deleting images from the gallery
  const handleDelete = (index: number) => {
    if (images.length > index) {
      // need to reverse the index here to account for reverse display
      const originalIndex = images.length - 1 - index;
      const newImages = images.filter(
        (_: any, i: number) => i !== originalIndex
      );
      setImages(newImages);
    }
  };

  return (
    <Box sx={{width: '100%'}}>
      <Box
        sx={{
          display: 'grid',
          gap: theme.spacing(1),
          padding: theme.spacing(1),
          gridTemplateColumns: {
            // Show 3 images per row on mobile
            xs: 'repeat(3, 1fr)',
            // Show 4 images per row on tablet
            sm: 'repeat(4, 1fr)',
            // Show 6 images per row on small desktop
            md: 'repeat(6, 1fr)',
            // Show 8 images per row on big desktop
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
        {/* Image Gallery - Reversed order for newest first */}
        {[...images].reverse().map((image: any, index: number) =>
          image['attachment_id'] === undefined ? (
            <ImageListItem
              key={`${fieldName}-image-${index}`}
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
                }}
              >
                <Box
                  component="img"
                  src={URL.createObjectURL(image)}
                  onClick={() => setopen(URL.createObjectURL(image))}
                  alt={`Photo ${index + 1}`}
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    bgcolor: theme.palette.background.lightBackground,
                  }}
                />
                {!disabled && (
                  <ImageListItemBar
                    sx={{
                      background: theme.palette.primary.dark[70],
                    }}
                    position="top"
                    actionIcon={
                      <IconButton
                        sx={{color: 'white'}}
                        onClick={() => handleDelete(index)}
                        size="large"
                      >
                        <DeleteIcon />
                      </IconButton>
                    }
                    actionPosition="right"
                  />
                )}
              </Box>
            </ImageListItem>
          ) : (
            <ImageListItem
              key={`${fieldName}-image-icon-${index}`}
              // Set to null to show download popup
              onClick={() => setopen(null)}
              sx={{
                cursor: 'pointer',
                borderRadius: theme.spacing(1),
                overflow: 'hidden',
                boxShadow: theme.shadows[2],
                aspectRatio: '4/3',
                '&:hover': {
                  boxShadow: theme.shadows[4],
                },
              }}
            >
              <UnavailableImage />
            </ImageListItem>
          )
        )}
      </Box>
    </Box>
  );
};

/**
 * A photo capture and management component. Supports taking photos via device
 * camera, displaying them in a grid, and instructing re: permissions across
 * different platforms
 */
export const TakePhoto: React.FC<
  FieldProps &
    Props &
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
      ValueTextProps?: React.HTMLAttributes<HTMLSpanElement>;
      ErrorTextProps?: React.HTMLAttributes<HTMLSpanElement>;
      NoErrorTextProps?: React.HTMLAttributes<HTMLSpanElement>;
    }
> = props => {
  const [open, setOpen] = React.useState(false);
  const [photoPath, setPhotoPath] = React.useState<string | null>(null);
  const [noPermission, setNoPermission] = React.useState<boolean>(false);
  const navigate = useNavigate();

  // Handles photo capture with permission checks
  const takePhoto = async () => {
    if (Capacitor.getPlatform() === 'web') {
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

    try {
      const photoResult = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        correctOrientation: true,
        promptLabelHeader: 'Take or select a photo',
      });

      const image = await base64ImageToBlob(photoResult);
      const newImages =
        props.field.value !== null ? props.field.value.concat(image) : [image];
      props.form.setFieldValue(props.field.name, newImages, true);
    } catch (err: any) {
      logError(err);
      props.form.setFieldError(props.field.name, err.message);
    }
  };

  const error = props.form.errors[props.field.name];
  const errorText = error ? (
    <span {...props.ErrorTextProps}>{error as string}</span>
  ) : (
    <span {...props.NoErrorTextProps}></span>
  );

  const images = props.form.values[props.field.name] ?? [];
  const disabled = props.disabled ?? false;
  const hasUndownloaded = hasUndownloadedImages(images);
  const projectId = props.form.values['_project_id'];

  return (
    <FieldWrapper
      heading={props.label}
      subheading={props.helperText || props.helpertext}
      required={props.required}
    >
      <Box sx={{width: '100%'}}>
        {/* Download Banner */}
        {hasUndownloaded && (
          <Alert severity="info" sx={{mb: 2}}>
            To download existing photos, please go to the{' '}
            {
              // Deeplink directly to settings tab
            }
            <Link
              onClick={() => {
                navigate(
                  ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
                    projectId +
                    `?${ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE_TAB_Q}=settings`
                );
              }}
            >
              {NOTEBOOK_NAME_CAPITALIZED} Settings Tab
            </Link>{' '}
            and enable attachment download.
          </Alert>
        )}

        {images.length === 0 ? (
          <EmptyState onAddPhoto={takePhoto} />
        ) : (
          <ImageGallery
            images={images}
            setOpen={(path: string | null) => {
              setOpen(true);
              setPhotoPath(path);
            }}
            setImages={(newfiles: Array<any>) => {
              props.form.setFieldValue(props.field.name, newfiles, true);
            }}
            disabled={disabled}
            fieldName={props.field.name}
            onAddPhoto={takePhoto}
          />
        )}

        {noPermission && (
          <Alert severity="error" sx={{width: '100%', mt: 2}}>
            {Capacitor.getPlatform() === 'web' && (
              <>
                Please enable camera permissions for this page. Look for the
                camera permissions button in your browser's address bar.
              </>
            )}
            {Capacitor.getPlatform() === 'android' && (
              <>
                Please enable camera permissions for {APP_NAME}. Go to your
                device Settings &gt; Apps &gt; {APP_NAME} &gt; Permissions &gt;
                Camera and select "Ask every time" or "Allow only while using
                the app".
              </>
            )}
            {Capacitor.getPlatform() === 'ios' && (
              <>
                Please enable camera permissions for {APP_NAME}. Go to your
                device Settings &gt; Privacy & Security &gt; Camera &gt; and
                ensure that {APP_NAME} is enabled.
              </>
            )}
          </Alert>
        )}

        <FaimsAttachmentManagerDialog
          project_id={projectId}
          open={open}
          setopen={() => setOpen(false)}
          filedId={props.id}
          path={photoPath}
          isSyncing={props.issyncing}
        />
      </Box>
    </FieldWrapper>
  );
};

export default TakePhoto;

// const uiSpec = {
//   'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
//   'component-name': 'TakePhoto',
//   'type-returned': 'faims-attachment::Files', // matches a type in the Project Model
//   'component-parameters': {
//     fullWidth: true,
//     name: 'take-photo-field',
//     id: 'take-photo-field',
//     helperText: 'Take a photo',
//     variant: 'outlined',
//     label: 'Take Photo',
//   },
//   validationSchema: [['yup.object'], ['yup.nullable']],
//   initialValue: null,
// };
