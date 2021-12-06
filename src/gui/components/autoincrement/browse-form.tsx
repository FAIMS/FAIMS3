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
 * Filename: form.tsx
 * Description:
 *   TODO
 */

import {Link as RouterLink} from 'react-router-dom';
import {Button} from '@material-ui/core';

import * as ROUTES from '../../../constants/routes';
import {ProjectID} from '../../../datamodel/core';
import {AutoIncrementReference} from '../../../datamodel/database';

type AutoIncrementConfigFormProps = {
  project_id: ProjectID;
  reference: AutoIncrementReference;
};
export default function AutoIncrementConfigForm(
  props: AutoIncrementConfigFormProps
) {
  const {project_id, reference} = props;

  return (
    <div>
      {project_id} {reference.form_id} {reference.field_id}
      <Button
        color="primary"
        component={RouterLink}
        to={
          ROUTES.PROJECT +
          project_id +
          ROUTES.AUTOINCREMENT +
          reference.form_id +
          '/' +
          reference.field_id
        }
      >
        Edit Allocations
      </Button>
    </div>
  );
}
