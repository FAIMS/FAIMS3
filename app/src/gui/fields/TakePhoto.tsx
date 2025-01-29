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
 *   TODO : to add function check if photo be downloaded
 */

import {Camera, CameraResultType, Photo} from '@capacitor/camera';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import Button, {ButtonProps} from '@mui/material/Button';
import {FieldProps} from 'formik';
import React from 'react';

// import ImageList from '@mui/material/ImageList';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import {Alert, List, ListItem, Typography, useMediaQuery} from '@mui/material';
import IconButton from '@mui/material/IconButton';
import ImageListItem from '@mui/material/ImageListItem';
import ImageListItemBar from '@mui/material/ImageListItemBar';
import {createTheme, styled} from '@mui/material/styles';
import {logError} from '../../logging';
import FaimsAttachmentManagerDialog from '../components/ui/Faims_Attachment_Manager_Dialog';
import {Capacitor} from '@capacitor/core';
import {APP_NAME} from '../../buildconfig';
import FieldWrapper from './fieldWrapper';

function base64image_to_blob(image: Photo): Blob {
  if (image.base64String === undefined) {
    throw Error('No photo data found');
  }
  // from https://stackoverflow.com/a/62144916/1306020
  const rawData = atob(image.base64String);
  const bytes = new Array(rawData.length);
  for (let x = 0; x < rawData.length; x++) {
    bytes[x] = rawData.charCodeAt(x);
  }
  const arr = new Uint8Array(bytes);
  const blob = new Blob([arr], {type: 'image/' + image.format});
  return blob;
}

interface Props {
  helpertext?: string; // this should be removed but will appear in older notebooks
  helperText?: string;
  label?: string;
  issyncing?: string;
  isconflict?: boolean;
  required?: boolean;
}

type ImageListProps = {
  images: Array<any>;
  setopen: any;
  setimage: any;
  disabled: boolean;
  fieldName: string;
};
const theme = createTheme();
/******** create own Image List for dynamic loading images TODO: need to test if it's working on browsers and phone *** Kate */
const ImageGalleryList = styled('ul')(() => ({
  display: 'grid',
  padding: 0,
  margin: theme.spacing(0, 4),
  gap: 8,
  [theme.breakpoints.up('sm')]: {
    gridTemplateColumns: 'repeat(2, 1fr)',
  },
  [theme.breakpoints.up('md')]: {
    gridTemplateColumns: 'repeat(4, 1fr)',
  },
  [theme.breakpoints.up('lg')]: {
    gridTemplateColumns: 'repeat(5, 1fr)',
  },
}));

const FAIMSViewImageList = (props: {
  images: Array<any>;
  fieldName: string;
  setopen: Function;
}) => {
  return (
    <List>
      {props.images.map((image, index) =>
        image['attachment_id'] === undefined ? (
          <ListItem
            key={props.fieldName + index}
            id={props.fieldName + index + 'image'}
          >
            <img
              // {...srcset(item.img, 121, item.rows, item.cols)}
              style={{maxHeight: 300, maxWidth: 200}}
              src={URL.createObjectURL(image)}
              loading="lazy"
            />
          </ListItem>
        ) : (
          // ?? not allow user to delete image if the image is not download yet
          <FAIMSImageIconList
            index={index}
            setopen={props.setopen}
            fieldName={props.fieldName}
          />
        )
      )}
    </List>
  );
};

const FAIMSImageIconList = (props: {
  index: number;
  setopen: Function;
  fieldName: string;
}) => {
  const {index, setopen} = props;
  return (
    <ImageListItem key={`${props.fieldName}-image-icon-${index}`}>
      <IconButton aria-label="image" onClick={() => setopen(null)}>
        <ImageIcon />
      </IconButton>
    </ImageListItem>
  );
};

const FAIMSImageList = (props: ImageListProps) => {
  const {images, setopen, setimage, fieldName} = props;
  const disabled = props.disabled ?? false;
  const handelonClick = (index: number) => {
    if (images.length > index) {
      const newimages = images.filter((image: any, i: number) => i !== index);
      setimage(newimages);
    }
  };

  if (images === null || images === undefined)
    return <span>No photo taken.</span>;
  if (disabled === true)
    return (
      <FAIMSViewImageList
        images={props.images}
        fieldName={props.fieldName}
        setopen={setopen}
      />
    );
  return (
    <ImageGalleryList>
      {props.images.map((image: any, index: number) =>
        image['attachment_id'] === undefined ? (
          <ImageListItem key={`${fieldName}-image-${index}`}>
            <img
              style={{
                objectFit: 'scale-down',
                cursor: 'allowed',
              }}
              src={URL.createObjectURL(image)}
              onClick={() => setopen(URL.createObjectURL(image))}
            />

            <ImageListItemBar
              sx={{
                background:
                  'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, ' +
                  'rgba(0,0,0,0.3) 70%, rgba(0,0,0,0) 100%)',
              }}
              title={''}
              position="top"
              actionIcon={
                <IconButton
                  sx={{color: 'white'}}
                  aria-label={`star ${index}`}
                  onClick={() => handelonClick(index)}
                >
                  <DeleteIcon />
                </IconButton>
              }
              actionPosition="left"
            />
          </ImageListItem>
        ) : (
          // ?? not allow user to delete image if the image is not download yet
          <FAIMSImageIconList
            key={`${fieldName}-image-${index}`}
            index={index}
            setopen={setopen}
            fieldName={fieldName}
          />
        )
      )}{' '}
    </ImageGalleryList>
  );
};

export const TakePhoto: React.FC<
  FieldProps &
    Props &
    ButtonProps & {
      ValueTextProps: React.HTMLAttributes<HTMLSpanElement>;
      ErrorTextProps: React.HTMLAttributes<HTMLSpanElement>;
      NoErrorTextProps: React.HTMLAttributes<HTMLSpanElement>;
    }
> = props => {
  const [open, setOpen] = React.useState(false);
  const [photoPath, setPhotoPath] = React.useState<string | null>(null);
  const [noPermission, setNoPermission] = React.useState<boolean>(false);

  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
      const image = base64image_to_blob(
        await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Base64,
          correctOrientation: true,
          promptLabelHeader: 'Take/Select a photo (drag to view more)',
        })
      );
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

  const title = props.label;
  const helperText = props.helpertext ?? props.helperText ?? undefined;

  return (
    <FieldWrapper
      heading={title}
      subheading={helperText}
      required={props.required}
    >
      <Button
        variant="contained"
        color="primary"
        fullWidth={isMobile ? true : false}
        onClick={takePhoto}
      >
        Take photo
        <span style={{width: 10}} />
        <CameraAltIcon />
      </Button>

      {noPermission && (
        <Alert severity="error" sx={{width: '100%'}}>
          {Capacitor.getPlatform() === 'web' && (
            <>
              Please enable camera permissions this page. In your browser, look
              to the left of the web address bar for a button that gives access
              to browser settings for this page.
            </>
          )}
          {Capacitor.getPlatform() === 'android' && (
            <>
              Please enable camera permissions for {APP_NAME}. Go to your device
              Settings &gt; Apps &gt; {APP_NAME} &gt; Permissions &gt; Camera
              and select "Ask every time" or "Allow only while using the app".
            </>
          )}
          {Capacitor.getPlatform() === 'ios' && (
            <>
              Please enable camera permissions for {APP_NAME}. Go to your device
              Settings &gt; Privacy & Security &gt; Camera &gt; and ensure that{' '}
              {APP_NAME} is enabled.
            </>
          )}
        </Alert>
      )}

      <FAIMSImageList
        images={props.form.values[props.field.name] ?? []}
        setopen={(path: string) => {
          setOpen(true);
          setPhotoPath(path);
        }}
        setimage={(newfiles: Array<any>) => {
          props.form.setFieldValue(props.field.name, newfiles, true);
        }}
        disabled={props.disabled ?? false}
        fieldName={props.field.name}
      />

      <Typography variant="caption" color="textSecondary">
        {errorText}
      </Typography>

      <FaimsAttachmentManagerDialog
        project_id={props.form.values['_project_id']}
        open={open}
        setopen={() => setOpen(false)}
        filedId={props.id}
        path={photoPath}
        isSyncing={props.issyncing}
      />
    </FieldWrapper>
  );
};

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
