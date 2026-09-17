// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: metadataRenderer.tsx
 * Description:
 *   TODO
 */

import {ProjectID} from '@faims3/data-model';
import {Chip} from '@mui/material';
import {selectProjectById} from '../../context/slices/projectSlice';
import {useAppSelector} from '../../context/store';
import {RichTextContent} from '@faims3/forms';

/** Typed design-metadata fields under uiDefinition.metadata.information. */
export type NotebookInformationField =
  | 'purposeMarkdown'
  | 'projectLeadLabel'
  | 'leadInstitution'
  | 'notebookVersion';

type MetadataProps = {
  project_id: ProjectID;
  // You can force through an explicit value
  explicitValue?: string;
  // OR read from uiDefinition.metadata.information
  informationField?: NotebookInformationField;
  metadata_label?: string;
  chips?: boolean;
};

export default function MetadataRenderer(props: MetadataProps) {
  const {
    project_id,
    informationField,
    metadata_label,
    chips = true,
    explicitValue,
  } = props;
  const project = useAppSelector(state => selectProjectById(state, project_id));
  const fromInformation =
    informationField && project
      ? project.uiDefinition.metadata.information[informationField]
      : undefined;
  const possibleValue = explicitValue ?? fromInformation ?? '';
  const value = possibleValue ? String(possibleValue) : '';

  // Design purpose markdown is rich text
  if (informationField === 'purposeMarkdown' && value !== '') {
    return <RichTextContent content={value} />;
  }

  // For other fields, use original rendering logic
  return chips && value !== '' ? (
    <Chip
      size={'small'}
      style={{marginRight: '5px', marginBottom: '5px'}}
      label={
        <>
          {metadata_label && <span>{metadata_label}: </span>}
          <span>{value}</span>
        </>
      }
    />
  ) : (
    <span>
      {metadata_label && <span>{metadata_label}: </span>}
      <span>{value}</span>
    </span>
  );
}
