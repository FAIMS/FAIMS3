import React from 'react';
import {ProjectUIModel} from '../../../../datamodel/ui';
export interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}
export interface RecordProps {
  id: string | number;
  title: string;
  route: string;
  lastUpdatedBy?: string;
  type?: string;
  children?: Array<RecordProps>;
  persistentData?: {[field_name: string]: any};
}

export interface RelationshipsComponentProps {
  parentRecords: Array<RecordProps> | null;
  childRecords: Array<RecordProps> | null;
  linkRecords: Array<RecordProps> | null;
  ui_specification?: ProjectUIModel;
}
