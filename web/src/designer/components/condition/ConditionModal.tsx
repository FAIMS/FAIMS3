// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law-abiding by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {Button, Dialog} from '@mui/material';
import {useState} from 'react';
import {ConditionControl} from './ConditionControl';
import {ConditionProps} from './types';
import QuizIcon from '@mui/icons-material/Quiz';

export const ConditionModal = (props: ConditionProps & {label: string}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="small"
        startIcon={<QuizIcon />}
      >
        {props.label}
      </Button>
      <Dialog open={open} fullWidth={true} maxWidth="lg">
        <ConditionControl
          initial={props.initial}
          onChange={props.onChange}
          field={props.field}
          view={props.view}
        />

        <Button onClick={() => setOpen(false)}>Close</Button>
      </Dialog>
    </>
  );
};
