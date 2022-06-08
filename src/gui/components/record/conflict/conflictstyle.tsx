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
  textstyle?: {[key: string]: string};
  cardcotent?: {[key: string]: string};
};

export const conflicticonstyle = {
  backgroundColor: '#f9dbaf',
  borderRadius: 35,
  textTransform: 'none',
  color: '#f29c3e',
};

export const cardsstyles: {[key: string]: cardstyletype} = {
  warning: {
    card: {
      borderColor: '#f9dbaf',
      height: '450px',
    },
    cardheader: {
      backgroundColor: '#f9dbaf',
      height: '50px',
      overflowY: 'auto',
    },
    iconstyle: {
      backgroundColor: '#f9dbaf',
      color: '#f29c3e',
      paddingLeft: '2px',
      paddingRight: '2px',
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
    text: 'Select Value from Conflict A or Conflict B',
  },
  default: {
    card: {
      borderColor: '#f6f6f6',
      height: '450px',
      paddingLeft: '0px',
      paddingRight: '0px',
    },
    cardheader: {
      backgroundColor: '#f6f6f6',
      // height:'35px',
    },
    cardcotent: {
      paddingLeft: '3px',
      paddingRight: '3px',
      overflow: 'visible',
    },
    icon: null,
  },
  success: {
    card: {
      borderColor: '#449852',
      height: '450px',
      border: '#449852 2px solid',
    },
    cardheader: {
      backgroundColor: '#449852',
    },
    cardcotent: {
      overflowY: 'auto',
    },
    iconstyle: {
      backgroundColor: '#449852',
      color: '#fff',
      paddingLeft: '2px',
      paddingRight: '2px',
    },
    textstyle: {
      paddingLeft: '10px',
      paddingRight: '10px',
    },
    icon: <CheckBoxIcon />,
  },
  reject: {
    card: {
      borderColor: '#ee565a',
      height: '450px',
      border: '#ee565a 2px solid',
    },
    cardheader: {
      backgroundColor: '#ee565a',
    },
    icon: <CancelSharpIcon />,
  },
  empty: {
    card: {
      height: '450px',
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
  },
  delete: {
    card: {
      borderColor: '#e8f4fd',
      height: '450px',
    },
    cardheader: {
      backgroundColor: '#e8f4fd',
      height: '50px',
    },
    iconstyle: {
      backgroundColor: '#e8f4fd',
      color: '#9ccffa',
      paddingLeft: '2px',
      paddingRight: '2px',
    },
    icon: (
      <ErrorOutlineOutlinedIcon
        style={{backgroundColor: '#e8f4fd', color: '#9ccffa'}}
      />
    ),
    text: 'Field is rejected',
  },
  conflict: {
    card: {
      borderColor: '#fff',
      height: '450px',
    },
    cardheader: {
      backgroundColor: '#fff',
      height: '50px',
    },
    icon: null,
    iconstyle: {
      backgroundColor: '#000',
      color: '#fff',
      paddingLeft: '2px',
      paddingRight: '2px',
    },
  },
  clear: {
    card: {
      borderColor: '#fff',
      height: '450px',
    },
    cardheader: {
      backgroundColor: '#fff',
      height: '50px',
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
};
