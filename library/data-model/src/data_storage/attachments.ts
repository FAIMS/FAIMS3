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
import {
  FAIMSAttachmentID,
  AttributeValuePair,
  FAIMSAttachment,
  FAIMSAttachmentReference,
} from '../types';

interface FullAttachments {
  [attachmentId: string]: PouchDB.Core.FullAttachment;
}

export function generate_file_name(): string {
  return 'file-' + uuidv4();
}

export function generateFAIMSAttachmentID(): FAIMSAttachmentID {
  return 'att-' + uuidv4();
}

export function file_data_to_attachments(
  avp: AttributeValuePair
): Array<AttributeValuePair | FAIMSAttachment> {
  if (avp.data === null) {
    return [avp];
  }

  const docs_to_dump: Array<AttributeValuePair | FAIMSAttachment> = [];
  const attach_refs: FAIMSAttachmentReference[] = [];
  for (const tmp_file of avp.data) {
    const file = tmp_file; // as File;
    const file_name = file.name ?? generate_file_name();
    const attach_id = generateFAIMSAttachmentID();
    const attach_doc: FAIMSAttachment = {
      _id: attach_id,
      attach_format_version: 1,
      avp_id: avp._id,
      revision_id: avp.revision_id,
      record_id: avp.record_id,
      created: avp.created,
      created_by: avp.created_by,
      filename: file_name,
      _attachments: {},
    };
    // in the browser, `file` will be a File and can
    // be passed as the data attribute
    // in Node, `file` will be a structure {type, data}
    // where `data` is a Buffer that we can pass in
    if (file.data) {
      attach_doc._attachments![attach_id] = {
        content_type: file.type,
        data: file.data,
      };
    } else {
      attach_doc._attachments![attach_id] = {
        content_type: file.type,
        data: file,
      };
    }

    attach_refs.push({
      attachment_id: attach_id,
      filename: file_name,
      file_type: file.type,
    });
    docs_to_dump.push(attach_doc);
  }
  avp.data = null;
  avp.faims_attachments = attach_refs;
  docs_to_dump.push(avp);
  return docs_to_dump;
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
  return attachments;
}

export function attachment_to_file(
  name: string,
  attachment: PouchDB.Core.Attachment
): File {
  const content_type = attachment.content_type;
  const data = (attachment as PouchDB.Core.FullAttachment).data;
  return new File([data], name, {type: content_type});
}

export function attachments_to_files(
  attachments: PouchDB.Core.Attachments
): File[] {
  const attach_list = [];
  for (const [name, attach] of Object.entries(attachments)) {
    attach_list.push(attachment_to_file(name, attach));
  }
  return attach_list;
}

export function file_attachments_to_data(
  avp: AttributeValuePair,
  attach_docs: FAIMSAttachment[]
): AttributeValuePair {
  const available_file_map: {[att_id: string]: File} = {};
  for (const attach_doc of attach_docs) {
    const attachments = attach_doc._attachments as FullAttachments;
    available_file_map[attach_doc._id] = attachment_to_file(
      attach_doc.filename,
      attachments[attach_doc._id]
    );
  }
  const attach_list = [];
  for (const attach_ref of avp.faims_attachments ?? []) {
    const possible_file = available_file_map[attach_ref.attachment_id];
    if (possible_file === undefined) {
      attach_list.push(attach_ref);
    } else {
      attach_list.push(possible_file);
    }
  }
  avp.data = attach_list;
  return avp;
}
