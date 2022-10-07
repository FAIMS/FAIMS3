import React from 'react';
import {RecordID} from '../../../../datamodel/core';

export interface LinkProps {
  relation_type_vocabPair?: string[];
  record_id: RecordID;
  hrid: string | number;
  type: string;
  route: string;

  section?: string;
  field_id?: string;
  field_label?: string;
  lastUpdatedBy?: string;

  link?: LinkProps;
}
export interface SortedDataType {
  [key: string]: Array<LinkProps>;
}

export interface RelationshipsComponentProps {
  related_records: Array<LinkProps> | null;
  related_links_from_fields: Array<LinkProps> | null;
  field_level_links: Array<LinkProps> | null;
  record_hrid: string;
  record_type: string;
}

export interface FieldRelationshipComponentProps {
  field_level_links: Array<LinkProps> | null;
  record_hrid: string;
  record_type: string;
  field_label: string;
}
export interface RecordLinksComponentProps {
  record_links: Array<LinkProps> | null;
  is_field: boolean;
}

export interface DataGridLinksComponentProps {
  links: Array<LinkProps> | null;
  show_actions: boolean;
}
export const PARENT_CHILD_VOCAB = ['has child', 'is parent'];
