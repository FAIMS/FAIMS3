/*
 * Copyright 2021 Macquarie University
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
 * Filename: ProjectButton.tsx
 * Description: This file define a list of buttons is create notebook UI
 *   TODO
 */
import AddCircleIcon from '@material-ui/icons/AddCircle';
import React from 'react';
import {Button,IconButton} from '@material-ui/core';
import CancelIcon from '@material-ui/icons/Cancel';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import AddIcon from '@material-ui/icons/Add';
import EditIcon from '@material-ui/icons/Edit';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';

export function CusButton(props:any) {
  return (
    <Button type={props.type} color={props.color} onClick={() => props.onButtonClick(props.id)} value={props.value} id={props.id}>{props.text}</Button>
  );
}

export function CloseButton(props:any){
	return (
		<IconButton edge="end" aria-label={props.text} onClick={() => props.onButtonClick(props.id)} value={props.value} id={props.id}>
            <CancelIcon  fontSize='small'/>
        </IconButton>
		)
}
export function UpButton(props:any){
	return (
		<IconButton edge="end" aria-label={props.text} onClick={() => props.onButtonClick(props.id)} value={props.value} id={props.id}>
            <ExpandLessIcon  fontSize='small'/>
        </IconButton>
		)
}
export function DownButton(props:any){
	return (
		<IconButton edge="end" aria-label={props.text} onClick={() => props.onButtonClick(props.id)} value={props.value} id={props.id}>
            <ExpandMoreIcon  fontSize='small'/>
        </IconButton>
		)
}
export function AddSectionButton(props:any){
	return (
		<IconButton edge="end" aria-label={props.text} onClick={() => props.onButtonClick(props.id)} value={props.value} id={props.id}>
            <AddCircleIcon  fontSize='small'/>
        </IconButton>
		)
}
export function EditButton(props:any){
	return (
		<IconButton edge="end" aria-label={props.text} onClick={() => props.onButtonClick(props.id)} value={props.value} id={props.id}>
            <EditIcon  fontSize='small'/>
        </IconButton>
		)
}
export function TickButton(props:any){
	return (
		<IconButton edge="end" type={props.type} id={props.id}>
            <CheckCircleIcon  fontSize='small'/>
        </IconButton>
		)
}
export function AddButton(props:any) {
  return ( 	

	<Button
        // variant="contained"
        color="primary"
        size="large"
        startIcon={<AddIcon />}
        type={props.type}  onClick={() => props.onButtonClick(props.id)} value={props.value} id={props.id}
      >
       {props.text}
     </Button>
  );
}

