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
 * Filename: PSectionComponents.tsx
 * Description:This is the file about Project User Invite
 * TODO: add select to user list area
 */
import React from 'react';
import Alert from '@material-ui/lab/Alert';
import {Formik, Form} from 'formik';
import SectionComponent from './PSectionComponent'
/* eslint-disable @typescript-eslint/no-unused-vars */

type SectionComponentsProps= {
    formuiSpec:any;
    formvariants:any;
    setFormuiSpec:any;
    formuiview:any;
    initialValues:any;
    setinitialValues:any;
    projectvalue:any;
    handleAutocomplete:any;
    formcomponents:any;
    designvalidate:any;
    setFormComponents:any;
  }
  
export default function SectionComponents(props: SectionComponentsProps){
      const {
          designvalidate,
          formcomponents,
          formuiview,
          initialValues,...others}= props
       const submithandler = (values:any) =>{
  
       }
      return (
          <Formik
            // enableReinitialize
            key={formuiview}
            initialValues={initialValues}
            validateOnMount={true}
            validationSchema={designvalidate}
            onSubmit={(values, {setSubmitting}) => {
              setTimeout(() => {
                setSubmitting(false);
                submithandler(values);
              }, 500);
            }}
          >
            {formProps => {
              return (
                <Form>
                  {formProps.isValid === false && (
                    <Alert severity="error">
                      Form has errors, please fill required field in settings for
                      each component.
                    </Alert>
                  )}
                  {formcomponents[formuiview].map((formcomponent: any, index: any) =>
                  <SectionComponent
                  formuiview={formuiview}
                  initialValues= {initialValues}
                  formcomponent={formcomponent}
                  index={index}
                  formProps={formProps}
                  formcomponents={formcomponents}
                  {...others} />)}
                </Form>
              );
            }}
          </Formik>
        );
  }
