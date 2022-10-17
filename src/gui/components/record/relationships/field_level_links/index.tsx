import React from 'react';
import CreateLinkComponent from '../create_links';
import {Box} from '@mui/material';

import {FieldRelationshipComponentProps} from '../types';
import DataGridFieldLinksComponent from './datagrid';
const relationship_types = [
  {link: 'is below', reciprocal: 'is above'},
  {link: 'is above', reciprocal: 'is below'},
  {link: 'is related to', reciprocal: 'is related to'},
  {link: 'has child', reciprocal: 'is child of'},
];

export default function FieldRelationshipComponent(
  props: FieldRelationshipComponentProps
) {
  // const [sortedData, setSortedData] = React.useState({} as SortedDataType);

  // // split the incoming array of links by their relationship type
  // // add a dynamic tab for each one
  // useEffect(() => {
  //   if (props.field_level_links !== null) {
  //     const dummySortObject: SortedDataType = {};
  //     props.field_level_links.map(l => {
  //       if (l.relation_type_vocabPair !== undefined) {
  //         const key = l.relation_type_vocabPair[0];
  //         // if the array hasn't been previously set, create it
  //         if (dummySortObject[key] === undefined) {
  //           dummySortObject[key] = [];
  //         }
  //         dummySortObject[key].push(l);
  //       } else {
  //         // try and collate link without relationship type?!
  //       }
  //     });
  //     setSortedData(dummySortObject);
  //
  //     // set the first array value as active
  //     // (if has child is present, set as active tab)
  //     if (Object.keys(dummySortObject).length > 0) {
  //       if (Object.keys(dummySortObject).includes(PARENT_CHILD_VOCAB[0])) {
  //         setValue(PARENT_CHILD_VOCAB[0]);
  //       } else {
  //         setValue(Object.keys(dummySortObject)[0]);
  //       }
  //     }
  //   }
  // }, [props.field_level_links]);

  return (
    <Box>
      <CreateLinkComponent
        relationship_types={relationship_types}
        record_hrid={props.record_hrid}
        record_type={props.record_type}
        field_label={props.field_label}
      />
      <Box sx={{my: 1}}>
        <DataGridFieldLinksComponent
          links={props.field_level_links}
          record_id={props.record_id}
          record_hrid={props.record_hrid}
          record_type={props.record_type}
          field_label={props.field_label}
        />
      </Box>
    </Box>
  );
}
