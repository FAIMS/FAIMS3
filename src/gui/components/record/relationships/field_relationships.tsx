import React from 'react';
import CreateLinkComponent from './create_links';
import TabContext from '@mui/lab/TabContext';
import {Box} from '@mui/material';
import TabList from '@mui/lab/TabList';
import Tab from '@mui/material/Tab';
import TabPanel from '@mui/lab/TabPanel';
import DataGridLinksComponent from './link_datagrid';
import {FieldRelationshipComponentProps} from './types';
const relationship_types = [
  {link: 'is below', reciprocal: 'is above'},
  {link: 'is above', reciprocal: 'is below'},
  {link: 'is related to', reciprocal: 'is related to'},
  {link: 'has child', reciprocal: 'is child of'},
];
export default function FieldRelationshipComponent(
  props: FieldRelationshipComponentProps
) {
  const [value, setValue] = React.useState('1');

  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    setValue(newValue);
  };
  return (
    <Box>
      <CreateLinkComponent
        relationship_types={relationship_types}
        record_hrid={props.record_hrid}
        record_type={props.record_type}
        field_label={props.field_label}
      />
      <TabContext value={value}>
        <Box mb={1}>
          <TabList
            onChange={handleChange}
            aria-label="Field children related tab"
          >
            <Tab label="Children" value="1" />
            <Tab label="Related" value="2" />
          </TabList>
        </Box>
        <TabPanel value="1" sx={{p: 0}}>
          <DataGridLinksComponent
            links={props.child_links}
            show_title={false}
            show_link_type={false}
            show_section={false}
            show_field={false}
            show_actions={true}
            field_label={props.field_label}
          />
        </TabPanel>
        <TabPanel value="2" sx={{p: 0}}>
          <DataGridLinksComponent
            links={props.related_links}
            show_title={false}
            show_link_type={false}
            show_section={false}
            show_field={false}
            show_actions={true}
            field_label={props.field_label}
          />
        </TabPanel>
      </TabContext>
    </Box>
  );
}
