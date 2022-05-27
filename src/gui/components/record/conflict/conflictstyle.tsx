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
 *   TODO
 */

import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import InfoIcon from '@mui/icons-material/Info';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CancelSharpIcon from '@mui/icons-material/CancelSharp';

export type cardstyletype = any;
// {
//   'card':{[key: string]: any};
//   'cardheader': {[key: string]: any};
//   'icon':any;
// }
export const cardsstyles: {[key: string]: cardstyletype} = {
  warning: {
    card: {
      borderColor: '#f9dbaf',
      height: '320px',
    },
    cardheader: {
      backgroundColor: '#f9dbaf',
      height: '50px',
      // height:'35px',
      // 'MuiCardHeader-action':{
      //   padding:'-5px',
      //   marginTop:'-5px'
      // }
    },
    iconstyle: {
      backgroundColor: '#f9dbaf',
      color: '#f29c3e',
      paddingLeft: 2,
      paddingRight: 2,
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
  },
  default: {
    card: {
      borderColor: '#f6f6f6',
      height: '320px',
    },
    cardheader: {
      backgroundColor: '#f6f6f6',
      // height:'35px',
    },
    icon: null,
  },
  success: {
    card: {
      borderColor: '#449852',
      height: '320px',
      border: '#449852 2px solid',
    },
    cardheader: {
      backgroundColor: '#449852',
    },
    iconstyle: {
      backgroundColor: '#449852',
      color: '#fff',
      paddingLeft: 2,
      paddingRight: 2,
    },
    textstyle: {
      paddingLeft: 10,
      paddingRight: 10,
    },
    icon: <CheckBoxIcon />,
  },
  reject: {
    card: {
      borderColor: '#ee565a',
      height: '320px',
      border: '#ee565a 2px solid',
    },
    cardheader: {
      backgroundColor: '#ee565a',
      // height:'35px',
      // 'MuiCardHeader-action':{
      //   padding:'-5px',
      //   marginTop:'-5px'
      // }
    },
    icon: <CancelSharpIcon />,
  },
  empty: {
    card: {
      height: '320px',
    },
    cardheader: {
      backgroundColor: '#e8f4fd',
    },
    iconstyle: {
      backgroundColor: '#e8f4fd',
      color: '#9ccffa',
      paddingLeft: 2,
      paddingRight: 2,
    },
  },
  delete: {
    card: {
      borderColor: '#e8f4fd',
      height: '320px',
    },
    cardheader: {
      backgroundColor: '#e8f4fd',
      height: '50px',
      // height:'35px',
      // 'MuiCardHeader-action':{
      //   padding:'-5px',
      //   marginTop:'-5px'
      // }
    },
    iconstyle: {
      backgroundColor: '#e8f4fd',
      color: '#9ccffa',
      paddingLeft: 2,
      paddingRight: 2,
    },
    icon: (
      <ErrorOutlineOutlinedIcon
        style={{backgroundColor: '#e8f4fd', color: '#9ccffa'}}
      />
    ),
  },
  conflict: {
    iconstyle: {
      backgroundColor: '#000',
      color: '#fff',
      paddingLeft: 2,
      paddingRight: 2,
    },
  },
};
