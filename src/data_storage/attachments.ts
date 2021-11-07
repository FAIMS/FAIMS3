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
 * Filename: attachments.ts
 * Description:
 *   TODO
 */
import PouchDB from 'pouchdb';
import {AttributeValuePair} from '../datamodel/database';

interface FullAttachments {
  [attachmentId: string]: PouchDB.Core.FullAttachment;
}

export function file_data_to_attachment(
  avp: AttributeValuePair
): AttributeValuePair {
  const file = avp.data as File;
  avp._attachments = {};
  avp._attachments[file.name] = {
    content_type: file.type,
    data: file,
  };
  avp.data = null;
  return avp;
}

function attachment_to_file(
  name: string,
  attachment: PouchDB.Core.Attachment
): File {
  const content_type = attachment.content_type;
  const data = (attachment as PouchDB.Core.FullAttachment).data;
  return new File([data], name, {type: content_type});
}

export function file_attachment_to_data(
  avp: AttributeValuePair
): AttributeValuePair {
  const attachments = avp._attachments as FullAttachments;
  const attach_list = [];
  for (const [pname, attach] of Object.entries(attachments)) {
    attach_list.push(attachment_to_file(pname, attach));
  }
  if (attach_list.length !== 1) {
    throw Error('This is not a correctly encoded file');
  }
  avp.data = attach_list[0];
  return avp;
}
