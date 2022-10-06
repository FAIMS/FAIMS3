import React from 'react';
import {RecordID} from '../../../../datamodel/core';

export interface RecordLinkProps {
  relation_type_vocabPair?: string[];
  record_id: RecordID;
  hrid: string | number;
  type: string;
  route: string;

  section?: string;
  field_id?: string;
  field_label?: string;
  lastUpdatedBy?: string;

  link?: RecordLinkProps;
}

// each link is RecordAFieldB---->RecordC
export interface LinkProps {
  relation_type_vocabPair: string[]; // [field, record] e.g., ['has child', 'is child of']

  // record A
  recordA_id: string | number;
  recordA_hrid: string;
  recordA_type: string;

  recordA_section?: string;
  recordA_field_id: string;
  recordA_field_label: string;

  // record B
  // linked_record: RecordLinkProps
  recordB_id: string | number;
  recordB_hrid: string; // hrid?
  recordB_type: string;
  recordB_route: string;
  recordB_lastUpdatedBy?: string;
}

export interface RelationshipsComponentProps {
  related_records: Array<RecordLinkProps> | null;
  new_related_links: Array<RecordLinkProps> | null;
  child_links: Array<LinkProps> | null;
  related_links: Array<LinkProps> | null;
  record_hrid: string;
  record_type: string;
}

export interface FieldRelationshipComponentProps {
  child_links: Array<LinkProps> | null;
  related_links: Array<LinkProps> | null;
  record_hrid: string;
  record_type: string;
  field_label: string;
}
export interface RecordLinksComponentProps {
  record_links: Array<RecordLinkProps> | null;
  is_field: boolean;
}

export interface DataGridLinksComponentProps {
  links: Array<LinkProps> | null;
  title?: string;
  show_title: boolean;
  show_link_type: boolean;
  show_section: boolean;
  show_field: boolean;
  show_actions: boolean;
  record_title?: string;
  field_label?: string;
}
