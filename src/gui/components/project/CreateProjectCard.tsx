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
 * Filename: project-create.tsx
 * Description:
 *   TODO
 */
import React from 'react';
import { useState, useEffect } from 'react'
import { makeStyles } from '@material-ui/core/styles';
import {v4 as uuidv4} from 'uuid';
import grey from '@material-ui/core/colors/grey';

import {Button, Grid, Box, ButtonGroup, Typography,AppBar,Hidden} from '@material-ui/core';
import {Formik, Form, Field, FormikProps,FormikValues} from 'formik';
import FieldsListCard from './tabs/FieldsListCard';
import FormElement from './FormElement';
import TestC from './tabs/TestC'
import {projectaddfield,FieldSettings,getcomponent,getfieldname,convertuiSpecToProps,setProjectInitialValues} from './data/ComponentSetting'
import {CusButton,CloseButton,UpButton,DownButton} from './tabs/ProjectButton'
const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(2),
  },
  newfield:{
    // backgroundColor:'#e1e4e8',
    // borderTop:'1px solid #e1e4e8',
  },
  newfield_button:{
    textAlign:'right',
  },
  addfield:{
    // border:'1px solid #e1e4e8',
    flexGrow: 1,
    padding: theme.spacing(2),
  }
}));




export default function CreateProjectCard() {

    const ini={_id:'new_notbook'}
    const classes = useStyles();
    const [projectvalue,setProjectValue]=useState(ini)
    const [initialValues,setinitialValues]=useState(ini)
    const [projectuiSpec,setProjectuiSpec] = useState<Array<any>>()
    const [formcomponents,setFormComponents]= useState<Array<any>>([])
    const [formuiSpec,setFormuiSpec]=useState<{fields:any,views:any}>({fields:{},views:{"start-view":{'fields':[],uidesign:'form'}}})
    const [isAddField,setIsAddField]=useState(true)
    const [currentView,setCurrentView]=useState('start-view')

    //  useEffect(() => {
    //  console.log(formcomponents)

    // }, [formcomponents,initialValues]);

    const submithandler = (values:any) =>{
    console.log('SAVE')
    console.log(values)
    }
    
    const changeuifield = (newfieldname:string,newfield:any,uiSpec:any) =>{
      //update the formuiSpec
      const fields=uiSpec
      fields[newfieldname]=newfield
      return fields;
    }

    const handleChangeForm = (event:any,type='change',value='') => {
      
      // setProjectValue()
      saveorsync()
      console.log(event.target.name+event.target.value)
      const updatedfield=getfieldname(event.target.name,'newfield');
      console.log(updatedfield)
      if (formuiSpec!==undefined && updatedfield.name!==''&& updatedfield.type!==''){
        const newfieldname=updatedfield.name
        const fieldtype=updatedfield.type
        const fieldprops=convertuiSpecToProps(formuiSpec['fields'][newfieldname])
        if(fieldtype==='required') fieldprops[fieldtype]=!fieldprops[fieldtype];
        else fieldprops[fieldtype]=event.target.value
        console.log(event.target.value)
        const newfield=getcomponent(fieldprops['type'],fieldprops);
        setFormuiSpec({...formuiSpec,fields:changeuifield(newfieldname,newfield,formuiSpec['fields'])})
        const formcomponet=formcomponents
        formcomponet.map(item=>{
          item.id===updatedfield.index?item['uiSpec']['fields']=changeuifield(newfieldname,newfield,item['uiSpec']['fields']):item
        }
          )
        // formcomponet[updatedfield.index]['uiSpec']['fields']=changeuifield(newfieldname,newfield,formcomponet[updatedfield.index]['uiSpec']['fields'])
        setFormComponents(formcomponet)
        

        
        
      }
      // return true;
     }

     /****This function is to save data to DB TODO LIST*********/
     const saveorsync = () =>{
     	console.log('save')
     }

    const handleAddField = (id:any) =>{
      
      const length=uuidv4()
      const name='newfield'+length
      const newfield=getcomponent(id,{'name':name,label:id})
      const newuiSpec=formuiSpec.fields;
      newuiSpec[name]=newfield
      const newviews=formuiSpec.views
      newviews[currentView]['fields']=[...newviews[currentView]['fields'],name]
      const fieldprops=convertuiSpecToProps(newfield)
      const newuiSpeclist=FieldSettings(newfield,name,fieldprops)
      setinitialValues({...initialValues,...setProjectInitialValues(newuiSpeclist,currentView,{})})
      setFormComponents([...formcomponents,{id:length,uiSpec:newuiSpeclist}])
      setFormuiSpec({fields:newuiSpec,views:newviews})
      console.log('ini')
      console.log(initialValues)
      setIsAddField(false)
    }

    const handleRemoveField = (id:any)=>{
      console.log(formcomponents[id])
      
      
      // const newviews=formuiSpec.views
      // newviews[currentView]['fields']=newviews[currentView]['fields'].filter((field:any)=>field!==formcomponents[id]['uiSpec']['views'][currentView]['fields'][0])
      // setFormuiSpec({fields:formuiSpec.fields,views:newviews})
      // const newcom=formcomponents.filter(formcomponent=>formcomponent.id!==id)
      // setFormComponents(newcom)
      // console.log(newcom)
    }
    const handleAddFieldButton = ()=>{
      setIsAddField(true)
    }
    const handleCloseFieldButton = () =>{
      setIsAddField(false)
    }

    const swithField = (index:any,type:boolean) =>{
      // const newviews=formuiSpec.views
      // const fields=newviews[currentView]['fields']
      // const field=fields[index]
      // const components=formcomponents
      // const component=formcomponents[index]
      // fields.splice(index,1)
      // components.splice(index,1)
      // if(type) index=index+1 //down
      // else index=index-1 //up
      // fields.splice(index,0,field)
      // components.splice(index,0,component)
      // newviews[currentView]['fields']=fields
      // setFormuiSpec({fields:formuiSpec.fields,views:newviews})
      // setFormComponents(components)
      console.log(formcomponents)
    }
    const handleUpFieldButton = (index:any) =>{
      swithField(index,false)
    }
    const handleDownFieldButton = (index:any) =>{
      
      swithField(index,true)
      
    }




  return ( 
    <div className={classes.root}> 
     <Grid container  >
      <Grid item sm={8} xs={12}>
        <Formik
          initialValues={initialValues}
          validateOnMount={true}
          onSubmit={(values, {setSubmitting}) => {
            setTimeout(() => {
              setSubmitting(false);
              submithandler(values)
            }, 500);}}
        >
        {formProps => {
              return (
                <Form >
                {formcomponents.length>0?formcomponents.map((formcomponent:any,index:any)=>
                <Grid container className={classes.newfield} key={`formcompoenet-form-${index}`}>
                <Grid item sm={10} xs={11}>
                  <FormElement key={index} view='start-view' uiSpec={formcomponent.uiSpec}  formProps={formProps} handleChangeForm={handleChangeForm} />
                </Grid>
                <Grid item sm={2} xs={12} className={classes.newfield_button}>
                  {index>0?<UpButton  onButtonClick={handleUpFieldButton} value={index} id={index} text='X' />:''}
                  {index<formcomponents.length-1?<DownButton  onButtonClick={handleDownFieldButton} value={index} id={index} text='X' />:''}
                  <CloseButton  onButtonClick={handleRemoveField} value={formcomponent.id} id={formcomponent.id} text='X' />
                </Grid>
                </Grid>
                ):''}
                </Form>
              );
        }}
        </Formik>
        <CusButton  onButtonClick={handleAddFieldButton}  text='Add' />
        {isAddField?
        <Grid container className={classes.addfield} >
          <Grid item sm={11} xs={11}>
          <FieldsListCard cretenefield={handleAddField} />
          </Grid>
          <Grid item sm={1} xs={12} className={classes.newfield_button}>  
            <CloseButton  onButtonClick={handleCloseFieldButton} text='X' />
          </Grid>
        </Grid>
        :''}
      </Grid>
      <Grid item sm={4} xs={12}>
        <Box
              bgcolor={grey[200]}
              pl={2}
              pr={2}
              style={{overflowX: 'scroll'}}
            >
              <pre>{JSON.stringify(formuiSpec, null, 2)}</pre>
        </Box>
      </Grid>
    </Grid>
  </div>

  );
}

