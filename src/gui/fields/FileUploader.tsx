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
 * Filename: RelatedRecordSelector.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {FieldProps} from 'formik';
import Dropzone from 'react-dropzone';
import {getDefaultuiSetting} from './BasicFieldSettings';
import {ProjectUIModel} from '../../datamodel/ui';
import LibraryBooksIcon from '@material-ui/icons/Bookmarks';
/* eslint-disable @typescript-eslint/no-unused-vars */
interface Props {
  accepted_filetypes?: string | string[];
  disabled?: boolean;
  multiple?: boolean;
  maximum_number_of_files?: number;
  maximum_file_size?: number; // this is in bytes
  minimum_file_size?: number; // this is in bytes
}

export function FileUploader(props: FieldProps & Props) {
  const accepted_filetypes = props.accepted_filetypes ?? 'image/*';
  const disabled = props.disabled ?? false;
  const multiple = props.multiple ?? true;
  const maximum_number_of_files = props.maximum_number_of_files ?? 0;
  const maximum_file_size = props.maximum_file_size ?? Infinity;
  const minimum_file_size = props.minimum_file_size ?? 0;

  const current_files: File[] = props.form.values[props.field.name] ?? [];

  // TODO: work out correct typing for getRootProps and getInputProps
  return (
    <Dropzone
      // accept={accepted_filetypes}
      disabled={disabled}
      multiple={multiple}
      maxFiles={maximum_number_of_files}
      maxSize={maximum_file_size}
      minSize={minimum_file_size}
      onDrop={files => {
        props.form.setFieldValue(props.field.name, current_files.concat(files));
      }}
    >
      {({getRootProps, getInputProps}) => (
        <div {...getRootProps()}>
          <input {...getInputProps()} />
          <p>Drag 'n' drop some files here, or click to select files</p>
          <p>File uploaded:</p>
          <ul>
            {current_files.map((file: File, index: number) => (
              <li key={index}>{file.name}</li>
            ))}
          </ul>
        </div>
      )}
    </Dropzone>
  );
}

const uiSpec = {
  'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
  'component-name': 'FileUploader',
  'type-returned': 'faims-core::File', // matches a type in the Project Model
  'component-parameters': {
    name: 'file-upload-field',
    id: 'file-upload-field',
  },
  validationSchema: [['yup.mixed']],
  initialValue: null,
};

const uiSetting = () => {
  const newuiSetting: ProjectUIModel = getDefaultuiSetting();
  newuiSetting['viewsets'] = {
    settings: {
      views: [],
      label: 'settings',
    },
  };

  return newuiSetting;
};

export const FileuploadSetting = [uiSetting(), uiSpec];

export function getFileuploadBuilderIcon() {
  return <LibraryBooksIcon />;
}
