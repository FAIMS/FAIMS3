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
import LibraryBooksIcon from '@mui/icons-material/Bookmarks';
import {Typography} from '@mui/material';
import {
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import {IconButton} from '@mui/material';
/* eslint-disable @typescript-eslint/no-unused-vars */
interface Props {
  accepted_filetypes?: string | string[];
  disabled?: boolean;
  multiple?: boolean;
  maximum_number_of_files?: number;
  maximum_file_size?: number; // this is in bytes
  minimum_file_size?: number; // this is in bytes
  helperText?: string;
}

export function FileUploader(props: FieldProps & Props) {
  const accepted_filetypes = props.accepted_filetypes ?? 'image/*';
  const disabled = props.disabled ?? false;
  const multiple = props.multiple ?? true;
  const maximum_number_of_files = props.maximum_number_of_files ?? 0;
  const maximum_file_size = props.maximum_file_size ?? Infinity;
  const minimum_file_size = props.minimum_file_size ?? 0;

  const [current_files, setfiles] = React.useState(
    props.form.values[props.field.name] ?? []
  );
  console.log(current_files);
  // TODO: work out correct typing for getRootProps and getInputProps
  const baseStyle = {
    // color: '#bdbdbd',
    backgroundColor: '#fafafa',
    padding: '20px',
    transition: 'border .24s ease-in-out',
    border: '2px #eeeeee dashed',
    borderRadius: 2,
  };

  const handelonClick = (index: number) => {
    if (current_files.length > index) {
      const newfiles = current_files.filter(
        (file: File, i: number) => i !== index
      );
      setfiles(newfiles);
      console.log(current_files);
      props.form.setFieldValue(props.field.name, newfiles);
    }
  };

  return (
    <div>
      <Dropzone
        // accept={accepted_filetypes}
        disabled={disabled}
        multiple={multiple}
        maxFiles={maximum_number_of_files}
        maxSize={maximum_file_size}
        minSize={minimum_file_size}
        onDrop={files => {
          const newfiles = current_files.concat(files);
          setfiles(newfiles);
          props.form.setFieldValue(props.field.name, newfiles);
        }}
      >
        {({getRootProps, getInputProps}) => (
          <div {...getRootProps()}>
            <div style={baseStyle}>
              <input {...getInputProps()} />
              <p>Drag 'n' drop some files here, or click to select files</p>
            </div>
          </div>
        )}
      </Dropzone>
      <p>File uploaded:</p>
      <List>
        {current_files.map((file: File, index: number) => (
          <ListItem key={index} id={index + 'file'}>
            <ListItemText primary={file.name} secondary={file.type} />
            {file.type !== undefined && file.type.includes('image') ? (
              <img
                style={{maxHeight: 300, maxWidth: 200}}
                src={URL.createObjectURL(file)}
              />
            ) : (
              ''
            )}
            <ListItemSecondaryAction>
              <IconButton
                style={{color: '#000'}}
                aria-label="Delete this Attachment"
                onClick={() => handelonClick(index)}
                size="large"
              >
                <DeleteIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>
      <Typography variant="caption" color="textSecondary">
        {props.helperText}
      </Typography>
    </div>
  );
}

const uiSpec = {
  'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
  'component-name': 'FileUploader',
  'type-returned': 'faims-attachment::Files', // matches a type in the Project Model
  'component-parameters': {
    name: 'file-upload-field',
    id: 'file-upload-field',
    helperText: 'Choose a file',
  },
  validationSchema: [['yup.mixed']],
  initialValue: null,
};

const uiSetting = () => {
  const newuiSetting: ProjectUIModel = getDefaultuiSetting();
  newuiSetting['viewsets'] = {
    settings: {
      views: ['FormParamater'],
      label: 'settings',
    },
  };

  return newuiSetting;
};

export const FileuploadSetting = [uiSetting(), uiSpec];

export function getFileuploadBuilderIcon() {
  return <LibraryBooksIcon />;
}
