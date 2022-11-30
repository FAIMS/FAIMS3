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
 * Filename: confictstyle.tsx
 * Description:
 *   File contains all box style for different type of conflict to show user status of conflict
 */

import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import InfoIcon from '@mui/icons-material/Info';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CancelSharpIcon from '@mui/icons-material/CancelSharp';

export type cardstyletype = {
  card: {[key: string]: string};
  cardheader: {[key: string]: string};
  icon?: any;
  iconstyle?: {[key: string]: string};
  text?: string;
  text_style?: {[key: string]: string};
  card_content?: {[key: string]: string};
};

export const conflicticonstyle = {
  backgroundColor: '#f9dbaf',
  borderRadius: 35,
  textTransform: 'none',
  color: '#f29c3e',
  border: 'none',
};

export const card_styles: {[key: string]: cardstyletype} = {
  warning: {
    card: {
      borderColor: '#f9dbaf',
    },
    cardheader: {
      backgroundColor: '#f9dbaf',
    },
    iconstyle: {
      backgroundColor: '#f9dbaf',
      color: '#f29c3e',
      paddingLeft: '2px',
      paddingRight: '2px',
      borderRadius: '3px 0px 0px 3px',
      // border: '1px solid #b5b5b5',
    },
    icon: (
      <InfoIcon
        style={{
          backgroundColor: '#f9dbaf',
          color: '#f29c3e',
          paddingLeft: 2,
          paddingRight: 4,
        }}
      />
    ),
    text: 'Select value from Conflict A or Conflict B',
  },
  default: {
    card: {
      borderColor: '#f6f6f6',
    },
    cardheader: {
      backgroundColor: '#f6f6f6',
    },
    icon: null,
  },
  success: {
    card: {
      borderColor: '#449852',
      border: '#449852 2px solid',
    },
    cardheader: {
      backgroundColor: '#449852',
    },
    iconstyle: {
      backgroundColor: '#449852',
      color: '#fff',
      borderRadius: '3px 0px 0px 3px',
      // border: '1px solid #b5b5b5',
    },
    text_style: {
      padding: '1px 10px',
      border: '1px solid #eee',
      borderRadius: '0px 3px 3px 0px',
      marginRight: '5px',
    },
    icon: <CheckBoxIcon />,
  },
  reject: {
    card: {
      borderColor: '#ee565a',
      border: '#ee565a 2px solid',
    },
    cardheader: {
      backgroundColor: '#ee565a',
    },
    icon: <CancelSharpIcon fontSize={'small'} />,
  },
  empty: {
    card: {
      height: '450px',
    },
    cardheader: {
      backgroundColor: '#e8f4fd',
      minHeight: '100px',
    },
    iconstyle: {
      backgroundColor: '#e8f4fd',
      color: '#9ccffa',
      paddingLeft: '2px',
      paddingRight: '2px',
    },
  },
  delete: {
    card: {
      borderColor: '#e8f4fd',
    },
    cardheader: {
      backgroundColor: '#e8f4fd',
    },
    iconstyle: {
      backgroundColor: '#e8f4fd',
      color: '#9ccffa',
      paddingLeft: '2px',
      paddingRight: '2px',
      borderRadius: '3px 0px 0px 3px',
      // border: '1px solid #b5b5b5',
    },
    icon: (
      <ErrorOutlineOutlinedIcon
        fontSize={'small'}
        style={{backgroundColor: '#e8f4fd', color: '#9ccffa'}}
      />
    ),
    text: 'Field is rejected',
  },
  conflict: {
    card: {
      borderColor: '#fff',
    },
    cardheader: {
      backgroundColor: '#fff',
    },
    icon: null,
    iconstyle: {
      backgroundColor: '#000',
      color: '#fff',
      borderRadius: '3px 0px 0px 3px',
      border: '0px solid #b5b5b5',
    },
  },
  clear: {
    card: {
      borderColor: '#fff',
    },
    cardheader: {
      backgroundColor: '#fff',
      color: '#000',
    },
    iconstyle: {
      backgroundColor: '#fff',
      color: '#fff',
      paddingLeft: '2px',
      paddingRight: '2px',
    },
    icon: null,
    text: 'No Conflict',
  },
  automerge: {
    card: {
      borderColor: '#e8f4fd',
    },
    cardheader: {
      backgroundColor: '#e8f4fd',
    },
    iconstyle: {
      backgroundColor: '#e8f4fd',
      color: '#9ccffa',
      paddingLeft: '2px',
      paddingRight: '2px',
    },
    icon: (
      <InfoIcon
        style={{
          backgroundColor: '#e8f4fd',
          color: '#9ccffa',
        }}
        fontSize={'small'}
      />
    ),
    text: 'Field has been auto merged.',
  },
};
