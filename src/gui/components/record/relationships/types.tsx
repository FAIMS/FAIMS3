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

export interface RelatedType {
  parentRecords: Array<ParentLinkProps> | null;
  childRecords: Array<LinkProps> | null;
  linkRecords: Array<LinkProps> | null;
  ui_specification?: ProjectUIModel;
}

// each link is RecordAFieldB---->RecordC
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

export interface RelationshipsComponentProps {
  parent_links: Array<ParentLinkProps> | null;
  child_links: Array<LinkProps> | null;
  related_links: Array<LinkProps> | null;
  record_hrid: string;
  record_type: string;
}
export interface ParentLinksComponentProps {
  parent_links: Array<ParentLinkProps> | null;
}

export interface DataGridLinksComponentProps {
  links: Array<LinkProps> | null;
  title?: string;
  show_title: boolean;
  show_link_type: boolean;
  show_section: boolean;
  show_field: boolean;
  record_title?: string;
  field_label?: string;
}
