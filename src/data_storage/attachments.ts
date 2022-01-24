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
 * Filename: attachments.ts
 * Description:
 *   TODO
 */
import PouchDB from 'pouchdb';
import {v4 as uuidv4} from 'uuid';

import {AttributeValuePair} from '../datamodel/database';

interface FullAttachments {
  [attachmentId: string]: PouchDB.Core.FullAttachment;
}

export function generate_file_name(): string {
  console.debug('Generating a uuid-filename');
  return uuidv4();
}

export function file_data_to_attachments(
  avp: AttributeValuePair
): AttributeValuePair {
  if (avp.data === null) {
    console.debug('No data in', avp);
    return avp;
  }
  avp._attachments = {};
  for (const tmp_file of avp.data) {
    const file = tmp_file as File;
    const file_name = file.name ?? generate_file_name();
    avp._attachments[file_name] = {
      content_type: file.type,
      data: file,
    };
  }
  console.debug('Encoded attachments in avp', avp);
  avp.data = null;
  return avp;
}

export function files_to_attachments(files: File[]): FullAttachments {
  const attachments: FullAttachments = {};
  for (const file of files) {
    const file_name = file.name ?? generate_file_name();
    attachments[file_name] = {
      content_type: file.type,
      data: file,
    };
  }
  console.debug('Converted files to attachments', files, attachments);
  return attachments;
}

export function attachment_to_file(
  name: string,
  attachment: PouchDB.Core.Attachment
): File {
  console.debug('attachment?', attachment);
  const content_type = attachment.content_type;
  const data = (attachment as PouchDB.Core.FullAttachment).data;
  console.debug('blob?', data);
  return new File([data], name, {type: content_type});
}

export function attachments_to_files(
  attachments: PouchDB.Core.Attachments
): File[] {
  const attach_list = [];
  for (const [name, attach] of Object.entries(attachments)) {
    attach_list.push(attachment_to_file(name, attach));
  }
  console.debug('Converted attachments to files', attachments, attach_list);
  return attach_list;
}

export function file_attachments_to_data(
  avp: AttributeValuePair
): AttributeValuePair {
  const attachments = avp._attachments as FullAttachments;
  const attach_list = [];
  for (const [pname, attach] of Object.entries(attachments)) {
    attach_list.push(attachment_to_file(pname, attach));
  }
  console.debug('files?', attach_list);
  avp.data = attach_list;
  return avp;
}
