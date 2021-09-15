import React from 'react';
import {Tab,Tabs,Hidden,Grid} from '@material-ui/core';
import Icon from '@material-ui/core/Icon';
import { makeStyles } from '@material-ui/core/styles';
import { useState, useEffect } from 'react'
import TextField from '@material-ui/core/TextField';
import {AddSectionButton,EditButton,TickButton} from './ProjectButton';
import {FormForm} from '../FormElement';
import {gettabform} from '../data/ComponentSetting';

// type CTabProps = {
//   tabs:Array<string>
//   tab_id:string;
//   value:number;
//   handleChange:any;
//   handelonChangeLabel:any|null
// };

function a11yProps(tabname:any,index:any) {
  return {
    id: `${tabname}-${index}`,
    'aria-controls': `${tabname}panel-${index}`,
  };
}

const useStyles = makeStyles((theme) => ({
  fieldtab:{
    
    textAlign:'left',
    minWidth:55,
    backgroundColor:'#E7E9EB'
  },
  subtab:{
  	// borderTop:'1px solid',
  	// borderTopColor:theme.palette.primary.main
  },
  root:{

  }
}));

export function TabTab(props:any){
	const classes = useStyles();
  	const {tabs,tab_id,value,handleChange, ...other} = props
  	return (<Tabs
          value={value}
          onChange={handleChange}
          aria-label={tab_id}
          id={tab_id}
      >
        {tabs.map((tab:any,index:number)=>(
          <Tab className={classes.root} key={`${tab_id}-${index}`} 
          label={tab}  {...a11yProps(tab_id,index)} />  ))}  
      </Tabs>);
}

export function TabEditable(props: any) {
  const classes = useStyles();
  const {tabs,tab_id,value,handleChange, ...other} = props
  const [tablists,setTablist]=useState<Array<any>>(tabs)
  const [isedited, setisedited]=useState(false)
  const [isset,setIsset]=useState(false)
  useEffect(() => {
     setTablist(tabs);
    }, [tabs]);


 //  	const handleDoubleClick = (key:number) =>{
	// 	const newtabs=tablists;
	// 	newtabs[key]=false
	// 	setTablist(newtabs)
	// }

	const handleEdit = (event:any) => {
	  	setisedited(true)
  	
  	}
  	const handleAdd =  (event:any) => {
	  	const newtabs=tablists;
		newtabs[tablists.length]='New'+tablists.length
		setTablist(newtabs)
  		console.log("Add")
  		setIsset(!isset)
  	}

  	const handleSubmit = (event:any) =>{
  		console.log(event)
  		setisedited(false)
  	}

  	const handleSubmitForm = (values:any) =>{
  		
  		
  		const newtabs=tablists
  		const pretabs=tablists
  		console.log(pretabs)
  		Object.entries(values).map((value,index) =>newtabs[index]=value[1] )
  		props.handelonChangeLabel(newtabs,pretabs)
  		console.log(pretabs)
  		setTablist(newtabs) 
  		setisedited(false)
  		
  	}

  	const handleChangeForm =(event:any) =>{
  		// console.log(event.target.name+event.target.value)
  	}


  return tab_id==='primarytab'?(
      <Tabs
          value={value}
          onChange={handleChange}
          aria-label={tab_id}
          id={tab_id}
      >
        {tablists.map((tab,index)=>(
          <Tab className={classes.root} key={`${tab_id}-${index}`} 
          label={tab}  {...a11yProps(tab_id,index)} />  ))}  
      </Tabs>
    
  ):(	<Grid container className={classes.subtab}>
            
	        <Grid item sm={11} xs={12}>
	        {isedited===false?
		      <Tabs
		          value={value}
		          onChange={handleChange}
		          aria-label={tab_id}
		          id={tab_id}
		          orientation={tab_id==='subtab'?  "horizontal" :"vertical" }
		          
		      >
		        {tablists.map((tab,index)=>(
		          <Tab className={tab_id==='subtab'?  classes.subtab : classes.fieldtab} key={`${tab_id}-${index}`} label={tab}  {...a11yProps({tab_id},{index})}  />))}  
		      </Tabs>:
		      <FormForm uiSpec={gettabform(tabs)} currentView='start-view' handleChangeForm={handleChangeForm} handleSubmit={handleSubmitForm}/>}
		    </Grid>
		    <Grid item sm={1} xs={12}>
		    {isedited===false?<>
	      	<AddSectionButton onButtonClick={handleAdd} value={1} id='add' text='X'/></>:''}
	        
	        </Grid>
		</Grid>
    
  );
}
