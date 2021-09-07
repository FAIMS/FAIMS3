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
import PSettingCard from './tabs/PSettingCard';
import {getComponentFromField} from './FormElement';
import TestC from './tabs/TestC'
import {FieldSettings,getcomponent,getfieldname,convertuiSpecToProps,setProjectInitialValues,getid,sampleuispec} from './data/ComponentSetting'
import {CusButton,CloseButton,UpButton,DownButton,AddButton} from './tabs/ProjectButton'
import { List,ListItem } from "@material-ui/core";
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



const NEWFIELDS='newfield'
export default function CreateProjectCard() {

    const ini={_id:'new_notbook'}
    const classes = useStyles();
    const [projectvalue,setProjectValue]=useState(ini)
    const [initialValues,setinitialValues]=useState(ini)
    const [projectuiSpec,setProjectuiSpec] = useState<Array<any>>()
    const [formcomponents,setFormComponents]= useState<any>({'mainsection1':[]})
    const [formuiSpec,setFormuiSpec]=useState<{fields:any,views:any,variants:any,default_variants:any}>({fields:{},views:{},variants:{},default_variants:[]})
    const [isAddField,setIsAddField]=useState(true)
    const [currentView,setCurrentView]=useState('section1')
    const [designvalue,setDesignvalue]=useState<any>('settings')
    const [designvalues,setDesignvalues]=useState<any>([])
    const [settingvalue,setsettingvalue]=useState<any>({fields:{},views:{}})
    const [formView,setFormView]=useState('start-view')
    const [formvariants,setFormVariants]= useState<any>('main')
    const [formuiview,setformuiview]=useState(formvariants+currentView)



     useEffect(() => {
     console.log('update')
     setinit();
     console.log(formuiview)
    }, []);

     const generateunifromformui = (formui:any) =>{
      const newformcom=formcomponents
      formui['default_variants'].map((variant:any)=>{
        formui['variants'][variant]['views'].map((view:string)=>{
          newformcom[view]=[]
          formui['views'][view]['fields'].map((fieldname:string)=>{
            const field=formui['fields'][fieldname]
            const fieldprops=convertuiSpecToProps(field)
            const newuiSpeclist=FieldSettings(field,fieldname,fieldprops)
            newformcom[view]=[...newformcom[view],{id:fieldname.replace(NEWFIELDS,''),uiSpec:newuiSpeclist,designvalue:'settings'}];
          })
        })

      })
      setFormComponents(newformcom)
      setFormuiSpec(formui)
      console.log(formcomponents)
      console.log('set from sample')
      return true;
    }
    // const is_true=generateunifromformui(sampleuispec)

    const setinit =()=>{
      // // generate empty form
      // const view=formvariants+'section1'
      // setCurrentView(view);
      // const formview=formuiSpec.views
      // formview[view]={'fields':[],uidesign:'form'}
      // setFormuiSpec({fields:formuiSpec.fields,views:formview,variants:{'main':{views:[view,]}},default_variants:['main']})

      // setFormComponents((prevalue:any)=>{
      //   const newvalue=prevalue
      //   if(newvalue[view]===undefined) newvalue[view]=[]
      //   return newvalue;
      // })
      //generate form from uiSpecific
      generateunifromformui(sampleuispec)

    }

    

    const submithandler = (values:any) =>{

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
      const updatedfield=getfieldname(event.target.name,NEWFIELDS);
      if (formuiSpec!==undefined && updatedfield.name!==''&& updatedfield.type!==''){
        const newfieldname=updatedfield.name
        const fieldtype=updatedfield.type
        const fieldprops=convertuiSpecToProps(formuiSpec['fields'][newfieldname])
        if(fieldtype==='required') fieldprops[fieldtype]=!fieldprops[fieldtype];
        else fieldprops[fieldtype]=event.target.value

        const newfield=getcomponent(fieldprops['type'],fieldprops);
        setFormuiSpec({...formuiSpec,fields:changeuifield(newfieldname,newfield,formuiSpec['fields'])})

        const formcomponet=formcomponents
        
        setFormComponents((prevalue:any)=>{
          const newvalue=prevalue
          newvalue[formuiview].map((item:any)=>{
            item.id===updatedfield.index?item['uiSpec']['fields']=changeuifield(newfieldname,newfield,item['uiSpec']['fields']):item
          })
          return newvalue;
        })
        

        
        
      }
      // return true;
     }

     /****This function is to save data to DB TODO LIST*********/
     const saveorsync = () =>{
     }

    const handleAddField = (id:any) =>{
      
      const uuid=getid()
      const name=NEWFIELDS+uuid
      const newfield=getcomponent(id,{'name':name,label:id})
      const newuiSpec=formuiSpec.fields;
      newuiSpec[name]=newfield
      const newviews=formuiSpec.views
      newviews[formuiview]['fields']=[...newviews[formuiview]['fields'],name]
      const fieldprops=convertuiSpecToProps(newfield)
      const newuiSpeclist=FieldSettings(newfield,name,fieldprops)


      setinitialValues({...initialValues,...setProjectInitialValues(newuiSpeclist,formView,{})})
      const newvalue=formcomponents
      newvalue[formuiview]=[...newvalue[formuiview],{id:uuid,uiSpec:newuiSpeclist,designvalue:'settings'}];
      setFormComponents(newvalue)

      setFormuiSpec({fields:newuiSpec,views:newviews,variants:formuiSpec.variants,default_variants:formuiSpec.default_variants})

      setIsAddField(false)
      console.log(initialValues)
      console.log(formcomponents)
    }

    const handleRemoveField = (id:any)=>{

      
      
      const newviews=formuiSpec.views
      newviews[formuiview]['fields']=newviews[formuiview]['fields'].filter((field:any)=>field!==NEWFIELDS+id)
      setFormuiSpec({fields:formuiSpec.fields,views:newviews,variants:formuiSpec.variants,default_variants:formuiSpec.default_variants})
      const newcom=formcomponents
      newcom[formuiview].filter((formcomponent:any)=>formcomponent.id!==id)
      setFormComponents(newcom)
    }
    const handleAddFieldButton = ()=>{
      setIsAddField(true)
    }
    const handleCloseFieldButton = () =>{
      setIsAddField(false)
      console.log(formuiSpec)
    }

    const swithField = (index:any,type:boolean) =>{
      const newviews=formuiSpec.views
      const fields=newviews[formuiview]['fields']
      const field=fields[index]
      const components=formcomponents
      const component=formcomponents[formuiview][index]
      fields.splice(index,1)
      components[formuiview].splice(index,1)
      if(type) index=index+1 //down
      else index=index-1 //up
      fields.splice(index,0,field)
      components[formuiview].splice(index,0,component)
      newviews[formuiview]['fields']=fields
      setFormuiSpec({fields:formuiSpec.fields,views:newviews,variants:formuiSpec.variants,default_variants:formuiSpec.default_variants})
      setFormComponents(components)
    }
    const handleUpFieldButton = (index:any) =>{
      swithField(index,false)
    }
    const handleDownFieldButton = (index:any) =>{
      
      swithField(index,true)
      
    }

    const handelonClickSetting = (index:any,key:any) =>{

      const formcomponent=formcomponents
        formcomponent[formuiview].map((item:any)=>{
          item.id===key?item['designvalue']=index:item
        }
        )
       
      setFormComponents(formcomponent)
      const value=settingvalue
      value[key]=index
      value['start']=index

      setDesignvalue(index)


    }

    const handelonChangeSection = (id:string) =>{
      console.log(formvariants)
      setCurrentView(id)
      setformuiview(formvariants+id)
      const name=formvariants+id
      const newuiSpec=formuiSpec
      if(newuiSpec['views'][name]===undefined){
        newuiSpec['views'][name]={'fields':[],uidesign:'form'}
        newuiSpec['variants'][formvariants]['views']=[...newuiSpec['variants'][formvariants]['views'],name];
        setFormuiSpec(newuiSpec)
        setIsAddField(true)
      }

      const formview=formcomponents
      if(formview[name]===undefined){
        formview[name]=[]
        setFormComponents(formview)
      }

    }

    const handelonChangeVariants = (id:string)=>{
      setFormVariants(id)
      const name=id+currentView
      setformuiview(name)
      console.log(formuiview)
      const newuiSpec=formuiSpec
      if(newuiSpec['variants'][id]===undefined){
        newuiSpec['variants'][id]={views:[]}
        newuiSpec['default_variants']=[...newuiSpec['default_variants'],id];
        setFormuiSpec(newuiSpec)
        setIsAddField(true)
      }
      const formview=formcomponents
      if(formview[name]===undefined){
        formview[name]=[]
        setFormComponents(formview)
      }
    }

    
  return ( 
    <div className={classes.root}> 
     <Grid container  >
      <Grid item sm={8} xs={12}>
         <CusButton  onButtonClick={handelonChangeVariants}  text='main' value='1' id='main' color={formvariants==='main'?'primary':''}/>
        |<CusButton  onButtonClick={handelonChangeVariants}  text='photolog' value='1' id='photolog' color={formvariants==='photolog'?'primary':''}/>
        <br/><br/>
        <CusButton  onButtonClick={handelonChangeSection}  text='Section1' value='1' id='section1' color={currentView==='section1'?'primary':''}/>
        |<CusButton  onButtonClick={handelonChangeSection}  text='Section2' value='1' id='section2' color={currentView==='section2'?'primary':''}/>
        <br/><br/>
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
                {formcomponents[formuiview].length>0?formcomponents[formuiview].map((formcomponent:any,index:any)=>(
                <Grid container className={classes.newfield} key={`formcompoenet-form-${index}`}>
                <Grid item sm={10} xs={11}>
                  <Grid container spacing={1} >
                    <Grid item sm={4} xs={12} >
                      {formcomponent.uiSpec['views'][formView]['fields'].length>0?getComponentFromField(formcomponent.uiSpec,formcomponent.uiSpec['views'][formView]['fields'][0], formProps,handleChangeForm):''}
                    </Grid>
                    <Grid item sm={1} xs={3} >          
                      <PSettingCard handelonClick={handelonClickSetting} key_id={formcomponent.id}/>  
                    </Grid>
                    <Grid item sm={7} xs={9}>
                  
                      {formcomponent.uiSpec['views'][formcomponent.designvalue]['fields'].length>0?
                      formcomponent.uiSpec['views'][formcomponent.designvalue]['fields'].map((field:any) => {
                        return getComponentFromField(formcomponent.uiSpec,field, formProps,handleChangeForm);
                      }):''}
                      
                    </Grid>
                  </Grid>
                </Grid>
                <Grid item sm={2} xs={12} className={classes.newfield_button}>
                  {index>0?<UpButton  onButtonClick={handleUpFieldButton} value={index} id={index} text='X' />:''}
                  {index<formcomponents[formuiview].length-1?<DownButton  onButtonClick={handleDownFieldButton} value={index} id={index} text='X' />:''}
                  <CloseButton  onButtonClick={handleRemoveField} value={formcomponent.id} id={formcomponent.id} text='X' />
                </Grid>
                </Grid>
                )):''}
                </Form>
              );
        }}
        </Formik>
        <AddButton  onButtonClick={handleAddFieldButton}  text='ADD' />
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

