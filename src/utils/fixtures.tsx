import {v4 as uuidv4} from 'uuid';

export function related_links_from_fields(
  record_id: string,
  hrid: string,
  record_type: string
) {
  return [
    {
      record_id: record_id,
      hrid: hrid,
      type: record_type,
      route: 'route',
      relation_type_vocabPair: ['is child of', 'has parent'],
      link: {
        record_id: uuidv4(),
        hrid: 'Artefact-V3.4',
        type: 'Category-X',
        route: 'linked record route',
        section: 'Section Pass 1',
        field_id: uuidv4(),
        field_label: 'Container',
      },
      lastUpdatedBy: '10/12/2020 11:09am by John Smith',
    },
    {
      record_id: record_id,
      hrid: hrid,
      type: record_type,
      route: 'route',
      relation_type_vocabPair: ['is related to', 'is related to'],
      link: {
        record_id: uuidv4(),
        hrid: 'Mundi-V3.4',
        type: 'Water',
        route: 'linked record route',
        section: 'Section 1',
        field_id: uuidv4(),
        field_label: 'Sample ID',
      },
      lastUpdatedBy: '10/12/2020 11:09am by Chris Smith',
    },
    {
      record_id: uuidv4(),
      hrid: 'Feature-001',
      type: 'Artefact',
      route: 'linked record route',
      relation_type_vocabPair: ['is child of', 'has parent'],
      link: {
        record_id: record_id,
        hrid: hrid,
        type: record_type,
        route: 'route',
        section: 'Section A',
        field_id: uuidv4(),
        field_label: 'EH',
      },
      lastUpdatedBy: '01/09/2022 10:34am by Jo Jones',
    },
    {
      record_id: uuidv4(),
      hrid: 'Feature-002',
      type: 'Artefact',
      route: 'linked record route',
      relation_type_vocabPair: ['is child of', 'has parent'],
      link: {
        record_id: record_id,
        hrid: hrid,
        type: record_type,
        route: 'route',
        section: 'Section B',
        field_id: uuidv4(),
        field_label: 'PH',
      },
      lastUpdatedBy: '01/08/2022 8:34am by Jo Jones',
    },
    {
      record_id: uuidv4(),
      hrid: 'Feature-001',
      type: 'Artefact',
      route: 'linked record route',
      relation_type_vocabPair: ['contains', 'is contained by'],
      link: {
        record_id: record_id,
        hrid: hrid,
        type: record_type,
        route: 'route',
        section: 'Section B',
        field_id: uuidv4(),
        field_label: 'PH',
      },
      lastUpdatedBy: '20/08/2022 9:34am by Jo Jones',
    },
  ];
}
export function field_level_links(
  record_id: string,
  hrid: string,
  record_type: string
) {
  return [
    {
      record_id: uuidv4(),
      hrid: 'Feature-001',
      type: 'Artefact',
      route: 'linked record route',
      relation_type_vocabPair: ['is child of', 'has parent'],
      link: {
        record_id: record_id,
        hrid: hrid,
        type: record_type,
        route: 'route',
        section: 'Section A',
        field_id: uuidv4(),
        field_label: 'EH',
      },
      lastUpdatedBy: '01/09/2022 10:34am by Jo Jones',
    },
    {
      record_id: uuidv4(),
      hrid: 'Feature-002',
      type: 'Artefact',
      route: 'linked record route',
      relation_type_vocabPair: ['is child of', 'has parent'],
      link: {
        record_id: record_id,
        hrid: hrid,
        type: record_type,
        route: 'route',
        section: 'Section A',
        field_id: uuidv4(),
        field_label: 'EH',
      },
      lastUpdatedBy: '01/08/2022 8:34am by Jo Jones',
    },
    {
      record_id: uuidv4(),
      hrid: 'Feature-001',
      type: 'Artefact',
      route: 'linked record route',
      relation_type_vocabPair: ['is contained by', 'contains'],
      link: {
        record_id: record_id,
        hrid: hrid,
        type: record_type,
        route: 'route',
        section: 'Section A',
        field_id: uuidv4(),
        field_label: 'EH',
      },
      lastUpdatedBy: '20/08/2022 9:34am by Jo Jones',
    },
  ];
}
