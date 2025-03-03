/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: RelatedRecordSelector.tsx
 * Description:
 *   TODO
 */

import {
  FAIMSTypeName,
  generateFAIMSDataID,
  getPossibleRelatedRecords,
  LocationState,
  RecordMetadata,
  RecordReference,
} from '@faims3/data-model';
import {Grid, SelectChangeEvent, Typography} from '@mui/material';
import {FieldProps} from 'formik';
import React, {useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import * as ROUTES from '../../constants/routes';
import {selectActiveToken} from '../../context/slices/authSlice';
import {useAppSelector} from '../../context/store';
import {logError} from '../../logging';
import {
  addRecordLink,
  getRelatedRecords,
  remove_link_from_list,
  removeRecordLink,
} from '../components/record/relationships/RelatedInformation';
import CreateLinkComponent from '../components/record/relationships/create_links';
import {DataGridFieldLinksComponent} from '../components/record/relationships/field_level_links/datagrid';
import {selectAllProjects} from '../../context/slices/projectSlice';
import {compiledSpecService} from '../../context/slices/helpers/compiledSpecService';

function get_default_relation_label(
  multiple: boolean,
  value: any,
  type: string,
  relation_linked_vocabPair: Array<Array<string>>
) {
  if (type === 'Child') {
    return ['is child of', 'is parent of'];
  }
  if (value === null || value === undefined) {
    if (
      relation_linked_vocabPair === undefined ||
      relation_linked_vocabPair.length === 0
    )
      //get default value for relation_linked_vocabPair
      return [];
    else return relation_linked_vocabPair[0];
  }
  if (!multiple && value !== undefined && value['relation_type_vocabPair'])
    return value['relation_type_vocabPair'];

  const length = value.length;
  if (
    multiple &&
    length > 0 &&
    value[length - 1] !== undefined &&
    value[length - 1] !== null &&
    value[length - 1]['relation_type_vocabPair'] !== undefined
  )
    return value[length - 1]['relation_type_vocabPair'];

  return [];
}

/**
 * Remove any records from the array that are already linked to the current record.
 * @param multiple - do we allow multiple relations?
 * @param value - current value of the field
 * @param all_records - array of records that are available to link to
 * @returns a reduced array of records for linking
 */
function excludes_related_record(
  multiple: boolean,
  value: any,
  all_records: RecordReference[]
) {
  const relations: string[] = multiple ? [] : [value?.record_id];
  const records: RecordReference[] = [];

  // if we allow multiple links and we have a current value then extract
  // the record_ids from the current value and add them to the relations array
  if (multiple && value) {
    if (Array.isArray(value)) {
      value.map((record: RecordReference) =>
        record !== null ? relations.push(record.record_id) : record
      );
    } else {
      relations.push(value.record_id);
    }
  }

  // filter the all_records array to remove any records that are already linked
  // if we don't allow multiple values OR we have no current value
  // then all records would be included
  all_records.map((record: RecordReference) =>
    relations.includes(record.record_id) ? record : records.push(record)
  );
  return records;
}

interface RelatedRecordSelectorProps extends FieldProps {
  related_type: FAIMSTypeName;
  relation_type: FAIMSTypeName;
  multiple?: boolean;
  id: string;
  label?: string;
  InputLabelProps: {label: string};
  required: boolean;
  helperText?: string;
  disabled?: boolean;
  relation_linked_vocabPair: Array<Array<string>>;
  related_type_label?: string;
  current_form?: string;
  current_form_label?: string;
  isconflict?: boolean;
}

export function RelatedRecordSelector(props: RelatedRecordSelectorProps) {
  const activeToken = useAppSelector(selectActiveToken)!.parsedToken;
  const project_id = props.form.values['_project_id'] as string;
  const serverId = props.form.values['_server_id'] as string;
  const record_id = props.form.values['_id'];
  const field_name = props.field.name;
  const uiSpecId = useAppSelector(selectAllProjects).find(
    p => p.projectId === project_id
  )?.uiSpecificationId;
  const uiSpec = uiSpecId ? compiledSpecService.getSpec(uiSpecId) : undefined;

  if (!uiSpec) {
    return <p>Error... could not find ui specification.</p>;
  }

  const [relatedRecords, setRelatedRecords] = React.useState<RecordReference[]>(
    []
  );
  const multiple = props.multiple !== undefined ? props.multiple : false;
  const location = useLocation();
  let search = location.search.includes('link=')
    ? location.search.replace('?', '')
    : '';
  const [recordsInformation, setRecordsInformation] = React.useState<
    RecordMetadata[] | null
  >(null);
  const type = props.relation_type.replace('faims-core::', '');
  const lastvaluePair = get_default_relation_label(
    multiple,
    props.form.values[field_name],
    type,
    props.relation_linked_vocabPair
  );
  const [relationshipLabel, setRelationshipLabel] = React.useState<string>(
    lastvaluePair[1]
  );
  const [relationshipPair, setRelationshipPair] =
    React.useState<Array<string>>(lastvaluePair);
  const [selectedRecord, SetSelectedRecord] =
    React.useState<RecordReference | null>(null);
  const url_split = search.split('&');

  const [is_enabled, setIs_enabled] = React.useState(multiple ? true : false);

  if (
    url_split.length > 1 &&
    url_split[0].replace('field_id=', '') === props.id
  )
    search = search.replace(url_split[0] + '&' + url_split[1], '');
  if (search !== '') search = '&' + search;
  const hrid =
    props.current_form !== undefined
      ? (props.form.values['hrid' + props.current_form] ??
        props.form.values['_id'])
      : props.form.values['_id'];

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (project_id !== undefined && mounted && props.isconflict !== true) {
        // need to enable the field for multiple=false since it defaults to disabled
        // enable if there is no existing value or if the existing value doesn't have
        // a record id (why would it not have a record ID?)
        if (
          !multiple &&
          props.form.values[field_name] &&
          props.form.values[field_name]['record_id'] === undefined
        )
          setIs_enabled(true);
        // or just no existing value
        if (!multiple && !props.form.values[field_name]) setIs_enabled(true);

        const all_records = await getPossibleRelatedRecords(
          project_id,
          props.related_type,
          props.relation_type,
          record_id,
          field_name,
          relationshipPair,
          uiSpec
        );
        const records = excludes_related_record(
          multiple,
          props.form.values[field_name],
          all_records
        );

        setRelatedRecords(records);

        const records_info = await getRelatedRecords(
          activeToken,
          project_id,
          props.form.values,
          field_name,
          multiple,
          uiSpec
        );

        setRecordsInformation(records_info);
      }
    })();

    return () => {
      // executed when unmount
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // this is for conflict only
      if (project_id !== undefined && mounted && props.isconflict === true) {
        const records_info = await getRelatedRecords(
          activeToken,
          project_id,
          props.form.values,
          field_name,
          multiple,
          uiSpec
        );
        setRecordsInformation(records_info);
      }
    })();

    return () => {
      // executed when unmount
      mounted = false;
    };
  }, [props.form.values[field_name]]);

  // Note the "multiple" option below, that seems to control whether multiple
  // entries can in entered.
  // TODO: Have the relation_type set the multiplicity of the system

  const newState: LocationState = {
    parent_record_id: props.form.values._id, //current form record id
    parent_hrid: hrid,
    field_id: props.field.name, // the field identifier
    type: type, //type of this relation
    parent_link: location.pathname.replace(
      ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE,
      ''
    ), // current form link
    parent: {},
    relation_type_vocabPair: relationshipPair, //pass the value of vocalPair
  };
  const disabled = props.disabled ?? false;
  const location_state: any = location.state;
  if (location_state !== undefined && location_state !== null) {
    if (location_state.parent_record_id !== props.form.values._id)
      newState['parent'] = location.state;
    else if (location_state.parent !== undefined) {
      //when the record is the parent record, the record should be the one returned from child, so should get the parent information
      newState['parent'] = location_state.parent;
    }
  }
  const handleChange = (event: SelectChangeEvent) => {
    const value: string = event.target.value;
    setRelationshipLabel(value);
    //get the value of relation Pair
    if (props.relation_linked_vocabPair !== undefined) {
      let valuePair: string[] = [];
      props.relation_linked_vocabPair.map((r: string[]) =>
        r[1] === value ? (valuePair = r) : r
      );
      setRelationshipPair(valuePair);
      //reset the value of the record list
      const records = relatedRecords;
      records.map(record => (record['relation_type_vocabPair'] = valuePair));
      setRelatedRecords(records);
    }
  };

  const save_new_record = () => {
    const new_record_id = generateFAIMSDataID();
    const new_child_record = {
      record_id: new_record_id,
      project_id: project_id,
      // record_label:new_record_id
      relation_type_vocabPair: relationshipPair,
    };
    let newValue = props.form.values[field_name];
    if (multiple) {
      // edge case: existing value could be a singleton if schema was changed
      // but first make sure it's a relation record rather than eg. empty string
      if (Array.isArray(newValue))
        newValue = [...(newValue ?? []), new_child_record];
      else if (newValue.record_id !== undefined)
        newValue = [newValue, new_child_record];
      else newValue = [new_child_record];
    } else newValue = new_child_record;
    props.form.setFieldValue(props.field.name, newValue, true);
    return new_record_id;
  };

  /**
   * add_related_child - callback for CreateLinkComponent to add the selected record
   *  as a child of the current record.
   *  looks at `selectedRecord` to get the child
   */
  const add_related_child = () => {
    // skip the null value
    if (selectedRecord === null) return false;
    let newValue = props.form.values[field_name];

    if (multiple) newValue = [...(newValue ?? []), selectedRecord];
    else newValue = selectedRecord;

    props.form.setFieldValue(props.field.name, newValue, true);
    props.form.submitForm();
    const current_record = {
      record_id: record_id,
      field_id: field_name,
      relation_type_vocabPair: relationshipPair,
    };
    addRecordLink({
      childRecord: selectedRecord,
      parent: current_record,
      relationType: props.relation_type,
      projectId: project_id,
    })
      .then(child_record => {
        if (child_record !== null) {
          if (!multiple) setRecordsInformation([child_record]);
          else {
            // add child record to the array
            const new_records = [...(recordsInformation ?? []), child_record];
            // new_records.push(child_record)
            setRecordsInformation(new_records);
          }
        } else
          logError(
            `Child record is null after addRecordLink ${selectedRecord}`
          );
      })
      .catch(error => logError(error));
    const records = excludes_related_record(
      multiple,
      props.form.values[field_name],
      relatedRecords
    );
    setRelatedRecords(records);
    // now that we have a value, disable if we don't allow multiple values
    if (!multiple) setIs_enabled(false);
    //set the form value
    if (multiple) SetSelectedRecord(null);
    //call the function to trigger the child to be updated??TBD
    return true;
  };

  const remove_related_child = async (
    child_record_id: string | null | undefined,
    child_hrid: string | null | undefined
  ) => {
    if (child_record_id === null || child_record_id === undefined) return '';
    if (child_hrid === null || child_hrid === undefined)
      child_hrid = child_record_id;
    const child_record = {
      project_id: project_id,
      record_id: child_record_id,
      record_label: child_hrid,
      relation_type_vocabPair: relationshipPair,
    };
    const newValue: RecordReference[] = [];
    if (multiple) {
      // let child_record_index = -1;
      props.form.values[field_name].map((record: RecordReference) =>
        record.record_id === child_record.record_id
          ? record
          : newValue.push(record)
      );
      // if (child_record_index === 0 && newValue.length === 1) {
      //   newValue = [];
      // } else if (child_record_index > -1) {
      //   // only splice array when item is found
      //   newValue.splice(child_record_index, 1); // 2nd parameter means remove one item only
      // }
    }

    const records = relatedRecords;
    records.push(child_record);
    setRelatedRecords(records);

    if (!multiple) setIs_enabled(true);
    const current_record = {
      record_id: record_id,
      field_id: field_name,
      relation_type_vocabPair: relationshipPair,
    };
    //set the form value
    props.form.setFieldValue(props.field.name, newValue, true);
    try {
      await props.form.submitForm();
    } catch (error) {
      logError(error);
    }

    try {
      const child_record_id = await removeRecordLink(
        child_record,
        current_record,
        type
      );
      if (child_record_id !== null) {
        if (!multiple)
          setRecordsInformation([]); // fix multiple child parent issue
        else {
          const new_records = remove_link_from_list(
            recordsInformation ?? [],
            child_record_id
          );
          setRecordsInformation(new_records);
        }
      } else {
        logError(`Child record is null after addRecordLink ${selectedRecord}`);
        return '';
      }
    } catch (error) {
      logError(error);
      return '';
    }
    SetSelectedRecord(null);
    return props.form.values['_current_revision_id'];
    //call the function to trigger the child to be updated??TBD
  };

  return (
    <div id={field_name}>
      <Grid container spacing={1} direction="row" justifyContent="flex-start">
        <Grid item xs={12} sm={12} md={12} lg={12}>
          <CreateLinkComponent
            {...props}
            field_name={field_name}
            field_label={field_name}
            relatedRecords={relatedRecords}
            handleChange={handleChange}
            relationshipLabel={relationshipLabel}
            SetSelectedRecord={SetSelectedRecord}
            selectedRecord={selectedRecord}
            disabled={disabled}
            is_enabled={is_enabled}
            project_id={project_id}
            relation_type={type}
            serverId={serverId}
            add_related_child={add_related_child}
            pathname={
              ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
              serverId +
              '/' +
              project_id +
              ROUTES.RECORD_CREATE +
              props.related_type
            }
            state={newState}
            handleSubmit={() => props.form.submitForm()}
            save_new_record={save_new_record}
            handleCreateError={remove_related_child}
          />
        </Grid>
        {props.form.isValid === false && (
          <Grid item xs={12} sm={12} md={12} lg={12}>
            <Typography variant="caption" color="error">
              To enable Add record or Link, please make sure form has no errors
            </Typography>
          </Grid>
        )}
        <Grid item xs={12} sm={12} md={12} lg={12}>
          <Typography variant="caption">
            {props.helperText}
            {'   '}
          </Typography>
        </Grid>

        {!is_enabled && (
          <Grid item xs={12} sm={12} md={12} lg={12}>
            <Typography variant="caption" color="error">
              Only one related record allowed. Remove existing link to enable
              Add record or Link
            </Typography>
          </Grid>
        )}

        <Grid item xs={12} sm={12} md={12} lg={12}>
          {!!recordsInformation && recordsInformation.length > 0 ? (
            <DataGridFieldLinksComponent
              project_id={project_id}
              serverId={serverId}
              links={recordsInformation}
              record_id={record_id}
              record_hrid={props.form.values['_id']}
              record_type={props.form.values['type']}
              field_name={field_name}
              handleUnlink={remove_related_child}
              handleReset={() => {}}
              disabled={disabled}
              relation_type={type}
            />
          ) : (
            <></>
          )}
        </Grid>
      </Grid>
    </div>
  );
}
