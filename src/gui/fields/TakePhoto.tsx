/*
 * Copyright 2021 Macquarie University
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
 *   TODO
 */

import React from 'react';
import {FieldProps} from 'formik';
import Button, {ButtonProps} from '@material-ui/core/Button';
import {Plugins, CameraResultType, CameraPhoto} from '@capacitor/core';

const {Camera} = Plugins;

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
  const blob = new Blob([arr], {type: image.format});
  return blob;
}

export class TakePhoto extends React.Component<
  FieldProps &
    ButtonProps & {
      ValueTextProps: React.HTMLAttributes<HTMLSpanElement>;
      ErrorTextProps: React.HTMLAttributes<HTMLSpanElement>;
      NoErrorTextProps: React.HTMLAttributes<HTMLSpanElement>;
    }
> {
  async takePhoto() {
    try {
      const image = base64image_to_blob(
        await Camera.getPhoto({
          quality: 90,
          allowEditing: true,
          resultType: CameraResultType.Base64,
        })
      );
      console.log(image);
      this.props.form.setFieldValue(this.props.field.name, image);
    } catch (err: any) {
      console.error(err);
      this.props.form.setFieldError(this.props.field.name, err.message);
    }
  }
  render() {
    const image = this.props.field.value;
    const error = this.props.form.errors[this.props.field.name];
    let image_tag = <span>No photo taken.</span>;
    if (image !== null) {
      const image_ref = URL.createObjectURL(image);
      image_tag = <img className="faims-take-photo-img" src={image_ref} />;
    }
    let error_text = <span {...this.props['NoErrorTextProps']}></span>;
    if (error) {
      error_text = <span {...this.props['ErrorTextProps']}>{error}</span>;
    }
    return (
      <div>
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
          Take Photo
        </Button>
        {image_tag}
        {error_text}
      </div>
    );
  }
}
