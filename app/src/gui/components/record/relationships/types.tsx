import React from 'react';

import {RecordID} from 'faims3-datamodel';
export interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}
export interface RecordProps {
  id: string | number;
  title: string;
}

export interface FieldLinkProps {
  record_id: RecordID;
  hrid: string | number;
  type: string;
  route: string;
  section: string;
  section_label: string;
  field_id: string;
  field_label: string;
  deleted?: boolean;
}
// model as RECORD --> FIELD
export interface RecordLinkProps {
  record_id: RecordID;
  hrid: string | number;
  type: string;
  route: string;
  relation_type_vocabPair: string[];
  link: FieldLinkProps;
  lastUpdatedBy?: string;
  relation_preferred?: boolean;
  deleted?: boolean;
  relation_type?: string;
}
/**************need to be updated later */
export interface ParentLinkProps {
  record_id: RecordID;
  hrid: string;
  route: string;
  section?: string;
  field_id?: string;
  field_label?: string;
  lastUpdatedBy?: string;
  type?: string;
  children?: Array<RecordProps>;
  persistentData?: {[field_name: string]: any};
  relation_type_vocabPair?: string[] | null;
  link_type?: string;
  link_id?: string;
  deleted?: boolean;
}
/**************need to be updated later */
export interface RelationshipsComponentProps {
  record_to_field_links: Array<RecordLinkProps> | null;
  record_id: RecordID;
  record_hrid: string;
  record_type: string;
  handleSetSection: Function;
  handleUnlink?: Function; //function to remove the link
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
  handleSetSection: Function;
  isconflict?: boolean; //add for conflict component
  handleUnlink?: Function; //function to remove the link
}

export interface DataGridLinksComponentProps {
  links: Array<RecordLinkProps> | null;
  record_id: RecordID;
  record_hrid: string;
  record_type: string;
  field_label: string;
  handleUnlink?: Function;
  handleReset?: Function;
  disabled?: boolean;
  handleMakePreferred?: Function;
  preferred?: string | null;
  relation_type?: string;
  relation_preferred_label?: string;
}
export const PARENT_CHILD_VOCAB = [
  'is child of',
  'has child',
  'is parent of',
  'has parent',
];
export type CreateRecordLinkProps = any;
