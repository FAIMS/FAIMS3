import React from 'react';
import { List,ListItem } from '@material-ui/core';
import SettingsIcon from '@material-ui/icons/Settings';
import PlaylistAddCheckIcon from '@material-ui/icons/PlaylistAddCheck';
import GroupIcon from '@material-ui/icons/Group';
import NoteIcon from '@material-ui/icons/Note';
import { makeStyles } from '@material-ui/core/styles';


const useStyles = makeStyles((theme) => ({
  settiglist: {
    // backgroundColor:'#e1e4e8',
    marginBottom:2,
    '&$selected': {
      backgroundColor: 'red',
      '&:hover': {
        backgroundColor: 'yellow',
      }
    },
    selected: {},
  }
}));

export function SettingCard(props:any){
	const  { handelonClick,key_id, ...other } = props;
	const classes = useStyles();

	return (
		<List component="nav" aria-label="settings bar" className={classes.settiglist}>
		  <ListItem button onClick={() => handelonClick('settings',key_id)} key='list1'  >
		    <SettingsIcon />
		  </ListItem>
		  <ListItem button onClick={() => handelonClick('valid',key_id)} key='list2'>
		    <PlaylistAddCheckIcon />
		  </ListItem>
		  <ListItem button onClick={() => handelonClick('access',key_id)} key='list3' >
		    <GroupIcon />
		  </ListItem>
		  <ListItem button onClick={() => handelonClick('notes',key_id)} key='list4'>
		    <NoteIcon />
		  </ListItem>
		</List>
		);
}



// import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
// import ListItemText from '@material-ui/core/ListItemText';
// import ListItemAvatar from '@material-ui/core/ListItemAvatar';
// import Checkbox from '@material-ui/core/Checkbox';
// import TextField from '@material-ui/core/TextField';
// import EditIcon from '@material-ui/icons/Edit';
// import IconButton from '@material-ui/core/IconButton';

// const variant_default=[{label:'main',isedited:false},{label:'photolog',isedited:false}]
// export function ListMenu(props:any) {
//   const classes = useStyles();
//   const [checked, setChecked] = React.useState([1]);
  



//   const [tablists,setTablists] = React.useState(variant_default);


//   const handleToggle = (value: number) => () => {
//     const currentIndex = checked.indexOf(value);
//     const newChecked = [...checked];

//     if (currentIndex === -1) {
//       newChecked.push(value);
//     } else {
//       newChecked.splice(currentIndex, 1);
//     }

//     setChecked(newChecked);
//   };

//   const handleEdit = (label:string) => {
//   	const newvalue=tablists
//   	newvalue.map((tab:any)=>tab.label===label?tab.isedited=!tab.isedited:tab)
//   	setTablists(newvalue)
//   	console.log(tablists)
  	
//   }

//   return (
//     <List dense className={classes.menulist}>
//       {tablists.map((tab:any)=>(tab.isedited? <TextField label='Edit'/>: <IconButton edge="end" aria-label="delete" onClick={()=>handleEdit(tab.label)}>
//               	{tab.label}<EditIcon fontSize="small" />
//               	</IconButton>))}
//       {tablists.map((tab:any,index:number) => {
//         const labelId = `checkbox-list-secondary-label-${tab.label}`;
//         return (
//           <ListItem key={tab.label} button onClick={()=>props.handleChange(index)} id={tab.label} >
            
//             {tab.isedited===true? <TextField label='Edit'/>:<ListItemText id={labelId} primary={tab.label} />}
//             <ListItemSecondaryAction>
//             	<IconButton edge="end" aria-label="delete" onClick={()=>handleEdit(tab.label)}>
//               	<EditIcon fontSize="small" />
//               	</IconButton>
//             </ListItemSecondaryAction>
//           </ListItem>
//         );
//       })}
//     </List>
//   );
// }

