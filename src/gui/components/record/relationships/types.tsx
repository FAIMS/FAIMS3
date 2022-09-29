import React from 'react';
import {RecordID} from '../../../../datamodel/core';

export interface ParentLinkProps {
  record_id: RecordID;
  hrid: string | number;
  route: string;
  section?: string;
  field_id?: string;
  field_name?: string;
  lastUpdatedBy?: string;
  type?: string;

  link_type: string;
  link_id: string;
}

export interface LinkProps {
  record_id: RecordID;
  hrid: string | number;
  type: string;
  route: string;

  section?: string;
  field_id?: string;
  field_name?: string;
  lastUpdatedBy?: string;

  link_type: string;
  link_id: string;
}

export interface RelationshipsComponentProps {
  parent_links: Array<ParentLinkProps> | null;
  child_links: Array<LinkProps> | null;
  related_links: Array<LinkProps> | null;
}
export interface ParentLinksComponentProps {
  parent_links: Array<ParentLinkProps> | null;
}
export interface ChildLinksComponentProps {
  child_links: Array<LinkProps> | null;
  show_title: boolean;
  show_link_type: boolean;
  show_section: boolean;
  show_field: boolean;
}
export interface RelatedLinksComponentProps {
  related_links: Array<LinkProps> | null;
  show_title: boolean;
  show_link_type: boolean;
  show_section: boolean;
  show_field: boolean;
}
