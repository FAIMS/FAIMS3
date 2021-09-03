import React from 'react';
import { List,ListItem } from "@material-ui/core";
import SettingsIcon from '@material-ui/icons/Settings';
import PlaylistAddCheckIcon from '@material-ui/icons/PlaylistAddCheck';
import GroupIcon from '@material-ui/icons/Group';
import NoteIcon from '@material-ui/icons/Note';
import { makeStyles } from '@material-ui/core/styles';
const useStyles = makeStyles((theme) => ({
  root: {
    backgroundColor:'#e1e4e8',
    marginBottom:2
  },
  
}));

export default function PSettingCard(props:any){
	const  { handelonClick,key_id, ...other } = props;
	const classes = useStyles();
	console.log(key_id)
	return (
		<List component="nav" aria-label="settings bar" className={classes.root}>
		  <ListItem button onClick={() => handelonClick(1,key_id)} key='list1'>
		    <SettingsIcon />
		  </ListItem>
		  <ListItem button onClick={() => handelonClick(3,key_id)} key='list2'>
		    <PlaylistAddCheckIcon />
		  </ListItem>
		  <ListItem button onClick={() => handelonClick(5,key_id)} key='list3'>
		    <GroupIcon />
		  </ListItem>
		  <ListItem button onClick={() => handelonClick(7,key_id)} key='list4'>
		    <NoteIcon />
		  </ListItem>
		</List>
		);
}

