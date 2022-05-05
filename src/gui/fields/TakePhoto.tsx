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
 *   TODO : to add function check if photoes be downloaded
 */

import React from 'react';
import {FieldProps} from 'formik';
import Button, {ButtonProps} from '@mui/material/Button';
import {Camera, CameraResultType, CameraPhoto} from '@capacitor/camera';
import {getDefaultuiSetting} from './BasicFieldSettings';
import {ProjectUIModel} from '../../datamodel/ui';

import ImageList from '@mui/material/ImageList';
import ImageListItem, {imageListItemClasses} from '@mui/material/ImageListItem';
import ImageListItemBar from '@mui/material/ImageListItemBar';
import IconButton from '@mui/material/IconButton';
import ImageIcon from '@mui/icons-material/Image';
import FaimsDialog from '../components/ui/Dialog';
import {Typography} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { styled } from '@mui/material/styles';

function base64image_to_blob(image: CameraPhoto): Blob {
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
  helpertext?: string;
  label?: string;
}
type ImgeProps = {
  image_ref?: string;
  setOpen?: any;
};

type ImgeListProps = {
  images: Array<any>;
  setopen: any;
  setimage: any;
};

/******** create own Image List for dynamic loading images TODO: need to test if it's working on browsers and phone *** Kate */
const ImageGalleryList = styled('ul')(({ theme }) => ({
  display: 'grid',
  padding: 0,
  margin: theme.spacing(0, 4),
  gap: 8,
  [theme.breakpoints.up('sm')]: {
      gridTemplateColumns: 'repeat(2, 1fr)'
  },
  [theme.breakpoints.up('md')]: {
      gridTemplateColumns: 'repeat(4, 1fr)'
  },
  [theme.breakpoints.up('lg')]: {
      gridTemplateColumns: 'repeat(5, 1fr)'
  },
}));

const FAIMESImageList = (props: ImgeListProps) => {
  const {images, setopen, setimage} = props;
  const handelonClick = (index: number) => {
    if (images.length > index) {
      const newimages = images.filter((image: any, i: number) => i !== index);
      setimage(newimages);
    }
  };
  console.log(images)
  return images !== null && images !== undefined ? (
    <ImageGalleryList>
      {images.map((image, index) =>
        image['attachment_id'] === undefined ? (
          <ImageListItem key={index}>
            <img
              style={{
                
                objectFit: 'none',
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
                  sx={{ color: 'white' }}
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
          <ImageListItem key={index}>
            <IconButton aria-label="image" onClick={()=>setopen(null)} >
              <ImageIcon />
            </IconButton>
          </ImageListItem>
        )
      )}{' '}
    </ImageGalleryList>
  ) : (
    <span>No photo taken.</span>
  );
};
interface State {
  open: boolean;
  photopath: string | null;
}
export class TakePhoto extends React.Component<
  FieldProps &
    Props &
    ButtonProps & {
      ValueTextProps: React.HTMLAttributes<HTMLSpanElement>;
      ErrorTextProps: React.HTMLAttributes<HTMLSpanElement>;
      NoErrorTextProps: React.HTMLAttributes<HTMLSpanElement>;
    },
  State
> {
  constructor(
    props: FieldProps &
      Props &
      ButtonProps & {
        ValueTextProps: React.HTMLAttributes<HTMLSpanElement>;
        ErrorTextProps: React.HTMLAttributes<HTMLSpanElement>;
        NoErrorTextProps: React.HTMLAttributes<HTMLSpanElement>;
      }
  ) {
    super(props);
    this.state = {
      open: false,
      photopath: null,
    };
  }
  async takePhoto() {
    try {
      const image = base64image_to_blob(
        await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Base64,
          correctOrientation: true,
        })
      );
      console.log(image);
      const newimages =
        this.props.field.value !== null
          ? this.props.field.value.concat(image)
          : [image];
      this.props.form.setFieldValue(this.props.field.name, newimages);
    } catch (err: any) {
      console.error('Failed to take photo', err);
      this.props.form.setFieldError(this.props.field.name, err.message);
    }
  }
  render() {
    const images = this.props.field.value;
    const error = this.props.form.errors[this.props.field.name];
    console.log(images);

    let error_text = <span {...this.props['NoErrorTextProps']}></span>;
    if (error) {
      error_text = <span {...this.props['ErrorTextProps']}>{error}</span>;
    }

    // https://mui.com/components/image-list/#masonry-image-list
    // Masonry image lists use dynamically sized container heights
    // that reflect the aspect ratio of each image. This image list
    // is best used for browsing uncropped peer content.
    // But it doesn't look like we support masonry right now.
    //
    // It also looks like we don't have multiple photos being returned...
    return (
      <div>
        {this.props.helpertext}
        <Button
          variant="outlined"
          color={'primary'}
          style={{marginRight: '10px'}}
          {...this.props}
          // Props from the metadata db will overwrite the above
          // style attributes, but not overwrite the below onclick.
          onClick={async () => {
            await this.takePhoto();
          }}
        >
          {this.props.label !== undefined && this.props.label !== ''
            ? this.props.label
            : 'Take Photo'}
        </Button>
        <FAIMESImageList
          images={images}
          setopen={(path: string) =>
            this.setState({open: true, photopath: path})
          }
          setimage={(newfiles: Array<any>) =>
            this.props.form.setFieldValue(this.props.field.name, newfiles)
          }
        />
        <Typography variant="caption" color="textSecondary">
          {error_text}{' '}
        </Typography>
        <FaimsDialog
          project_id={this.props.form.values['_project_id']}
          open={this.state.open}
          setopen={() => this.setState({open: false})}
          filedId={this.props.id}
          path={this.state.photopath}
        />
      </div>
    );
  }
}

const uiSpec = {
  'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
  'component-name': 'TakePhoto',
  'type-returned': 'faims-attachment::Files', // matches a type in the Project Model
  'component-parameters': {
    fullWidth: true,
    name: 'take-photo-field',
    id: 'take-photo-field',
    helpertext: 'Take a photo',
    variant: 'outlined',
    label: 'Take Photo',
  },
  validationSchema: [['yup.object'], ['yup.nullable']],
  initialValue: null,
};

const uiSetting = () => {
  const newuiSetting: ProjectUIModel = getDefaultuiSetting();
  newuiSetting['views']['FormParamater']['fields'] = ['label', 'helpertext'];
  newuiSetting['viewsets'] = {
    settings: {
      views: ['FormParamater'],
      label: 'settings',
    },
  };

  return newuiSetting;
};

export const TakePhotoSetting = [uiSetting(), uiSpec];
