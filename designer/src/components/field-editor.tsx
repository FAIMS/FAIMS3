// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
    Accordion, AccordionDetails, Stack,
    Typography, IconButton, Tooltip, Grid, Chip
} from "@mui/material";
import MuiAccordionSummary, { AccordionSummaryProps } from '@mui/material/AccordionSummary';

import ArrowDropUpRoundedIcon from '@mui/icons-material/ArrowDropUpRounded';
import ArrowDropDownRoundedIcon from '@mui/icons-material/ArrowDropDownRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';

import { MultipleTextFieldEditor } from "./Fields/MultipleTextField";
import { BaseFieldEditor } from "./Fields/BaseFieldEditor";
import { TakePhotoFieldEditor } from "./Fields/TakePhotoField";
import { TextFieldEditor } from "./Fields/TextFieldEditor";
import { DateTimeNowEditor } from "./Fields/DateTimeNowEditor";
import { OptionsEditor } from "./Fields/OptionsEditor";
import { MapFormFieldEditor } from "./Fields/MapFormFieldEditor";
import { RandomStyleEditor } from "./Fields/RandomStyleEditor";
import { RichTextEditor } from "./Fields/RichTextEditor";
import { RelatedRecordEditor } from "./Fields/RelatedRecordEditor";
import { BasicAutoIncrementerEditor } from "./Fields/BasicAutoIncrementer";
import { TemplatedStringFieldEditor } from "./Fields/TemplatedStringFieldEditor";
import { AdvancedSelectEditor } from "./Fields/AdvancedSelectEditor";

import { Notebook } from "../state/initial";
import { useAppDispatch, useAppSelector } from "../state/hooks";

import { styled } from '@mui/material/styles';

// customise the accordion summary a little 
const AccordionSummary = styled((props: AccordionSummaryProps) => (
    <MuiAccordionSummary
        expandIcon={<ArrowForwardIosRoundedIcon sx={{ fontSize: '1rem' }} />}
        {...props}
    />
))(({ theme }) => ({
    backgroundColor: '#EEF1F0',
    flexDirection: 'row-reverse',
    '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': {
        transform: 'rotate(90deg)',
    },
    '& .MuiAccordionSummary-content': {
        marginLeft: theme.spacing(1.5),
    },
}));

type FieldEditorProps = {
    fieldName: string,
    viewSetId?: string,
    viewId: string,
    expanded: boolean,
    handleExpandChange: (event: React.SyntheticEvent, newState: boolean) => void
};

export const FieldEditor = ({ fieldName, viewId, expanded, handleExpandChange }: FieldEditorProps) => {

    const field = useAppSelector((state: Notebook) => state['ui-specification'].fields[fieldName]);
    const dispatch = useAppDispatch();

    const fieldComponent = field['component-name'];

    const getFieldLabel = () => {
        return (field['component-parameters'] && field['component-parameters'].label) ||
            (field['component-parameters'].InputLabelProps && field['component-parameters'].InputLabelProps.label) ||
            field['component-parameters'].name;
    }
    const label = getFieldLabel();

    const moveFieldDown = (event: React.SyntheticEvent) => {
        event.stopPropagation();
        dispatch({ type: 'ui-specification/fieldMoved', payload: { fieldName, viewId, direction: 'down' } });
    }

    const moveFieldUp = (event: React.SyntheticEvent) => {
        event.stopPropagation();
        dispatch({ type: 'ui-specification/fieldMoved', payload: { fieldName, viewId, direction: 'up' } });
    }

    const deleteField = (event: React.SyntheticEvent) => {
        event.stopPropagation();
        dispatch({ type: 'ui-specification/fieldDeleted', payload: { fieldName, viewId } });
    }


    return (
        <Accordion
            key={fieldName}
            expanded={expanded}
            onChange={handleExpandChange}
            disableGutters
            square
            elevation={0}
            sx={{
                border: `1px solid #CBCFCD`,
                color: `#1A211E`,
                '&:not(:nth-of-type(2))': {
                    borderTop: 0,
                },
                '&:before': {
                    display: 'none',
                }
            }}
            TransitionProps={{ unmountOnExit: true }}
        >
            <AccordionSummary>
                <Grid container rowGap={1}>
                    <Grid container item xs={12} sm={5} columnGap={1} rowGap={0.5} alignItems='center'>
                        {
                            (typeof label === 'string' && label.length > 25) ? (
                                <Typography variant="subtitle2">{label.substring(0, 24)}...</Typography>
                            ) : (
                                <Typography variant="subtitle2">{label}</Typography>
                            )

                        }

                        <Chip label={fieldComponent} size="small" variant="outlined"
                            sx={{
                                '&.MuiChip-outlined': {
                                    background: '#f9fafb',
                                    color: '#546e7a',
                                    borderColor: '#546e7a',
                                }
                            }}
                        />
                        {field["component-parameters"].required &&
                            <Chip label="Required" size="small" color="primary" />
                        }
                    </Grid>
                    <Grid container item xs={12} sm={4} alignItems='center' pl={{ xs: 0, sm: 1}}>
                        {
                            (field["component-parameters"].helperText && field["component-parameters"].helperText.length > 60) ? (
                                <Typography variant="body2" fontSize={12} fontWeight={400} fontStyle='italic'>
                                    {field["component-parameters"].helperText.substring(0, 59)}...
                                </Typography>
                            ) : (
                                <Typography variant="body2" fontSize={12} fontWeight={400} fontStyle='italic'>
                                    {field["component-parameters"].helperText}
                                </Typography>
                            )
                        }
                    </Grid>
                    <Grid item xs={12} sm={3}>
                        <Stack direction='row' justifyContent={{ sm: 'right', xs: 'left' }}>
                            <Tooltip title="Delete Field">
                                <IconButton onClick={deleteField} aria-label='delete' size='small'>
                                    <DeleteRoundedIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title='Move up'>
                                <IconButton onClick={moveFieldUp} aria-label='up' size='small'>
                                    <ArrowDropUpRoundedIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title='Move down'>
                                <IconButton onClick={moveFieldDown} aria-label='down' size='small'>
                                    <ArrowDropDownRoundedIcon />
                                </IconButton>
                            </Tooltip>
                        </Stack>
                    </Grid>
                </Grid>
            </AccordionSummary>

            <AccordionDetails sx={{ padding: 3, backgroundColor: '#00804004' }}>
                {(fieldComponent === 'MultipleTextField' &&
                    <MultipleTextFieldEditor
                        fieldName={fieldName}
                    />)
                    ||
                    (fieldComponent === 'TakePhoto' && <TakePhotoFieldEditor fieldName={fieldName} />)
                    ||
                    (fieldComponent === 'TextField' && <TextFieldEditor fieldName={fieldName} />)
                    ||
                    (fieldComponent === 'DateTimeNow' && <DateTimeNowEditor fieldName={fieldName} />)
                    ||
                    (fieldComponent === 'Select' && <OptionsEditor fieldName={fieldName} />)
                    ||
                    (fieldComponent === 'MultiSelect' && <OptionsEditor fieldName={fieldName} />)
                    ||
                    (fieldComponent === 'AdvancedSelect' && <AdvancedSelectEditor fieldName={fieldName} />)
                    ||
                    (fieldComponent === 'RadioGroup' && <OptionsEditor fieldName={fieldName} />)
                    ||
                    (fieldComponent === 'MapFormField' && <MapFormFieldEditor fieldName={fieldName} />)
                    ||
                    (fieldComponent === 'RandomStyle' && <RandomStyleEditor fieldName={fieldName} />)
                    ||
                    (fieldComponent === 'RichText' && <RichTextEditor fieldName={fieldName} />)
                    ||
                    (fieldComponent === 'RelatedRecordSelector' && <RelatedRecordEditor fieldName={fieldName} />)
                    ||
                    (fieldComponent === 'BasicAutoIncrementer' &&
                        <BasicAutoIncrementerEditor
                            fieldName={fieldName}
                            viewId={viewId}
                        />)
                    ||
                    (fieldComponent === 'TemplatedStringField' &&
                        <TemplatedStringFieldEditor fieldName={fieldName} viewId={viewId} />
                    )
                    ||
                    <BaseFieldEditor
                        fieldName={fieldName}
                    />
                }
            </AccordionDetails>
        </Accordion>
    )
}