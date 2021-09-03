
import AddCircleIcon from '@material-ui/icons/AddCircle';
import React from 'react';
import {Button,IconButton} from '@material-ui/core';
import CancelIcon from '@material-ui/icons/Cancel';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
export function CusButton(props:any) {
  return (
    <Button type={props.type} variant="contained" onClick={() => props.onButtonClick(props.id)} value={props.value} id={props.id}>{props.text}</Button>
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
