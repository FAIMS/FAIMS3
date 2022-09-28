import * as React from 'react';
import {v4 as uuidv4} from 'uuid';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';

export default function CreateNewChildRecord() {
  const options = [
    {
      field_id: uuidv4(),
      field_title: 'field A',
      record_id: 'b44013d3-60fa-4542-90fd-a8c6daac3ef2',
      record_hrid: 'Eh (99) TEST 499 V.3 44444-04-04T04:45',
    },
    {
      field_id: uuidv4(),
      field_title: 'field B',
      record_id: 'b44013d3-60fa-4542-90fd-a8c6daac3ef2',
      record_hrid: 'Eh (99) TEST 499 V.3 44444-04-04T04:45',
    },
  ];

  return (
    <Autocomplete
      id="grouped-demo"
      options={options}
      groupBy={option => option.record_hrid}
      getOptionLabel={option => option.field_title}
      sx={{width: 300}}
      renderInput={params => (
        <TextField {...params} label="Create child record from.." />
      )}
    />
  );
}
