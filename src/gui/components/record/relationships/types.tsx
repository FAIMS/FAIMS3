import React from 'react';
import {RecordID} from '../../../../datamodel/core';

export interface FieldLinkProps {
  record_id: RecordID;
  hrid: string | number;
  type: string;
  route: string;
  section: string;
  field_id: string;
  field_label: string;
}
// model as RECORD --> FIELD
export interface RecordLinkProps {
  record_id: RecordID;
  hrid: string | number;
  type: string;
  route: string;
  relation_type_vocabPair?: string[];
  link: FieldLinkProps;
  lastUpdatedBy?: string;
}

export interface RelationshipsComponentProps {
  record_to_field_links: Array<RecordLinkProps> | null;
  record_id: RecordID;
  record_hrid: string;
  record_type: string;
}

export interface FieldRelationshipComponentProps {
  field_level_links: Array<RecordLinkProps> | null;
  record_id: RecordID;
  record_hrid: string;
  record_type: string;
  field_label: string;
}
export interface RecordLinksComponentProps {
  record_links: Array<RecordLinkProps> | null;
  record_id: RecordID;
}

export interface DataGridLinksComponentProps {
  links: Array<RecordLinkProps> | null;
  record_id: RecordID;
  record_hrid: string;
  record_type: string;
  field_label: string;
}
export const PARENT_CHILD_VOCAB = [
  'is child of',
  'has child',
  'is parent of',
  'has parent',
];
