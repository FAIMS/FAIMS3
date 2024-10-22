import React, {Dispatch, SetStateAction} from 'react';

import {RecordID, RecordReference, ProjectID} from '@faims3/data-model';
import {SelectChangeEvent} from '@mui/material';
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
// // model as RECORD --> FIELD
// export interface RecordLinkProps {
//   record_id: RecordID;
//   hrid: string | number;
//   type: string;
//   route: string;
//   relation_type_vocabPair: string[];
//   link: FieldLinkProps;
//   lastUpdatedBy?: string;
//   deleted?: boolean;
//   relation_type?: string;
// }

export interface RecordLinkProps extends RecordReference {
  hrid: string | number;
  type: string;
  route: string;
  link: FieldLinkProps;
  lastUpdatedBy?: string;
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

export const PARENT_CHILD_VOCAB = [
  'is child of',
  'has child',
  'is parent of',
  'has parent',
];

/**
 * Properties for CreateRecordLink component, also used in
 * CreateLinkComponent
 */
export interface CreateRecordLinkProps {
  field_name: string;
  relatedRecords: any;
  relationshipLabel: string;
  selectedRecord: any;
  disabled: boolean;
  is_enabled: boolean;
  project_id: ProjectID;
  relation_type: string;
  pathname: string;
  state: any;

  field_label: string;

  // from RelatedRecordSelectorProps
  id: string;
  label?: string;
  relation_linked_vocabPair: Array<Array<string>>;
  related_type: string;
  related_type_label?: string;
  form: any;

  handleChange: (e: SelectChangeEvent) => void;
  SetSelectedRecord: Dispatch<SetStateAction<RecordReference | null>>;
  add_related_child?: () => void;
  handleSubmit: () => void;
  save_new_record: () => void;
  handleCreateError: (id: any, hrid: any) => Promise<any>;
}
