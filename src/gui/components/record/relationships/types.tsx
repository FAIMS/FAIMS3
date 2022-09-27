import React from 'react';
import {RecordID} from '../../../../datamodel/core';

export interface RecordProps {
  record_id: RecordID;
  hrid: string | number;
  title: string;
  route: string;
  lastUpdatedBy?: string;
  type?: string;
  description?: string;
}

export interface RelationshipsComponentProps {
  parent_records: Array<RecordProps> | null;
  child_records: Array<RecordProps> | null;
  linked_records: Array<RecordProps> | null;
}
