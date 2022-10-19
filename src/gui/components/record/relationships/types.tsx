import React from 'react';

import {ProjectUIModel} from '../../../../datamodel/ui';
import {RecordID} from '../../../../datamodel/core';
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
}
export interface LinkProps {
  relation_type_vocabPair?: string[] | null; // [field, record] e.g., ['has child', 'is child of']

  // record A
  recordA_id: string | number;
  recordA_hrid: string;
  recordA_type: string;

  recordA_section?: string;
  recordA_field_id: string;
  recordA_field_label: string;

  // record B
  recordB_id: string | number;
  recordB_hrid: string; // hrid?
  recordB_type: string;
  recordB_route: string;
  recordB_lastUpdatedBy?: string;
}

export interface RelatedType {
  parentRecords: Array<ParentLinkProps> | null;
  childRecords: Array<LinkProps> | null;
  linkRecords: Array<LinkProps> | null;
  ui_specification?: ProjectUIModel;
}
/**************need to be updated later */
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
  handleUnlink?: Function;
  handleReset?: Function;
}
export const PARENT_CHILD_VOCAB = [
  'is child of',
  'has child',
  'is parent of',
  'has parent',
];
export type CreateRecordLinkProps = any;
