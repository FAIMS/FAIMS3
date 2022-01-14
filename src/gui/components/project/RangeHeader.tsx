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
 * Filename: FormElement.tsx
 * Description: This is the file for formelemnets for Notebook Creation, not contain any information about handler(check other files)
 *   TODO: any type
 *   TODO: different design settings
 */

import React from 'react';
import {useState, useEffect} from 'react';
import {
  get_user_friendly_status_for_project,
  UserFriendlyAutoincrementStatus,
} from '../../../datamodel/autoincrement';

export default function RangeHeader(props: {project: any}) {
  const [status, setStatus] = useState<UserFriendlyAutoincrementStatus[]>();
  let subtitle =
    props.project.created !== '' &&
    props.project.created !== undefined &&
    props.project.created !== 'Unknown'
      ? 'Created' + props.project.created
      : '';
  if (
    props.project.last_updated !== '' &&
    props.project.last_updated !== undefined &&
    props.project.last_updated !== 'Unknown'
  )
    subtitle =
      subtitle +
      ', last record updated ' +
      props.project.last_updated +
      '\xa0\xa0\xa0\xa0\xa0\xa0\xa0';

  useEffect(() => {
    get_user_friendly_status_for_project(props.project.project_id).then(res =>
      setStatus(res)
    );

    console.debug('Updating ranges for', props.project.project_id);
  }, [props.project.project_id]);

  return (
    <>
      {subtitle}
      {status !== undefined && status.length > 0 ? 'Range Index: ' : ''}
      {status?.map(sta => (
        <>
          {sta.label}:{sta.last_used}/{sta.end}
          {'\xa0\xa0\xa0\xa0\xa0\xa0\xa0'}
        </>
      ))}
    </>
  );
}
