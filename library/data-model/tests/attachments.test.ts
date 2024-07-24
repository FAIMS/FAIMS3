import PouchDB from 'pouchdb';
import {
  generate_file_name,
  generateFAIMSAttachmentID,
  file_data_to_attachments,
  files_to_attachments,
  attachment_to_file,
  attachments_to_files,
  file_attachments_to_data,
} from '../src/data_storage/attachments';

import {AttributeValuePair, FAIMSAttachment} from '../src/types';

describe('attachments', () => {
  describe('generate_file_name', () => {
    it('should generate a unique file name', () => {
      const name1 = generate_file_name();
      const name2 = generate_file_name();
      expect(name1).not.toBe(name2);
    });
  });

  describe('generateFAIMSAttachmentID', () => {
    it('should generate a unique FAIMSAttachmentID', () => {
      const id1 = generateFAIMSAttachmentID();
      const id2 = generateFAIMSAttachmentID();
      expect(id1).not.toBe(id2);
    });
  });

  describe('file_data_to_attachments', () => {
    it('should convert file data to attachments', () => {
      const avp: AttributeValuePair = {
        _id: 'test',
        avp_format_version: 1,
        type: 'file',
        annotations: [],
        revision_id: '1-1234567890abcdef1234567890abcdef',
        record_id: 'test',
        created: '2021-01-01T00:00:00.000Z',
        created_by: 'test',
        data: [
          {
            name: 'test.txt',
            type: 'text/plain',
            data: 'Some Text Data',
          },
        ],
      };
      const docs = file_data_to_attachments(avp);
      const attachments = docs.filter(
        doc => 'attach_format_version' in doc
      ) as FAIMSAttachment[];
      expect(attachments).toHaveLength(1);
      if (attachments) {
        expect(attachments[0]).toHaveProperty('filename', 'test.txt');
        const id = attachments[0]._id;
        if (attachments[0]._attachments) {
          expect(attachments[0]._attachments[id]).toHaveProperty(
            'data',
            'Some Text Data'
          );
        }
      }
    });
  });

  describe('files_to_attachments', () => {
    it('should convert files to attachments', () => {
      const file1 = new File(['test'], 'test.txt', {type: 'text/plain'});
      const file2 = new File(['hello'], 'hello.txt', {type: 'text/plain'});
      const attachments = files_to_attachments([file1, file2]);
      expect(attachments['test.txt']);
      expect(attachments['hello.txt']).toHaveProperty(
        'content_type',
        'text/plain'
      );
    });
  });

  describe('attachment_to_file', () => {
    it('should convert an attachment to a file', () => {
      const attachment: PouchDB.Core.Attachment = {
        content_type: 'text/plain',
        data: 'Some Text Data',
      };
      const file = attachment_to_file('test.txt', attachment);
      expect(file).toHaveProperty('name', 'test.txt');
      expect(file).toHaveProperty('type', 'text/plain');
      expect(file).toHaveProperty('size', 14);
    });
  });

  describe('attachments_to_files', () => {
    it('should convert attachments to files', () => {
      const attachments: PouchDB.Core.Attachments = {
        'test.txt': {
          content_type: 'text/plain',
          data: 'Some Text Data',
        },
        'hello.txt': {
          content_type: 'text/plain',
          data: 'aGVsbG8gd29ybGQ=',
        },
      };
      const files = attachments_to_files(attachments);
      expect(files).toHaveLength(2);
      expect(files[0]).toHaveProperty('name', 'test.txt');
      expect(files[1]).toHaveProperty('name', 'hello.txt');
    });
  });

  describe('file_attachments_to_data', () => {
    it('should convert file attachments to data', () => {
      const avp: AttributeValuePair = {
        _id: 'test',
        avp_format_version: 1,
        type: 'file',
        annotations: [],
        revision_id: '1-1234567890abcdef1234567890abcdef',
        record_id: 'test',
        created: '2021-01-01T00:00:00.000Z',
        created_by: 'test',
        data: [],
        faims_attachments: [
          {
            attachment_id: 'attachment1',
            filename: 'test.txt',
            file_type: 'text/plain',
          },
        ],
      };
      const attach_docs: FAIMSAttachment[] = [
        {
          _id: 'attachment1',
          attach_format_version: 1,
          avp_id: avp._id,
          revision_id: avp.revision_id,
          record_id: avp.record_id,
          created: avp.created,
          created_by: avp.created_by,
          filename: 'test.txt',
          _attachments: {
            attachment1: {
              content_type: 'text/plain',
              data: 'Some Text Data',
            },
          },
        },
      ];
      const data = file_attachments_to_data(avp, attach_docs);
      expect(data).toHaveProperty('data');
      expect(data.data[0].name).toBe('test.txt');
      expect(data.data[0].type).toBe('text/plain');
    });
  });
});
