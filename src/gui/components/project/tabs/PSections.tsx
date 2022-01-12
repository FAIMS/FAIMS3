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
 * Filename: SectionComponent.tsx
 * Description:This is the file about Project User Invite
 * TODO: add select to user list area
 */
import React from 'react';
import {TabEditable} from './TabTab';
import TabPanel from './TabPanel';
import SectionTab from './PSection';

type SectionTabsProps = {
  formuiSpec: any;
  formvariants: any;
  setFormuiSpec: any;
  formuiview: any;
  initialValues: any;
  setinitialValues: any;
  projectvalue: any;
  handleAutocomplete: any;
  formcomponents: any;
  designvalidate: any;
  fieldvalue: any;
  handleChangetabfield: any;
  handleChangeFormSection: any;
  setfieldValue: any;
  formsectionvalue: any;
  handleAddField: any;
  deleteform: any;
  sectiontabs: any;
  handelonChangeSection: any;
  handelonChangeLabelSection: any;
  setFormComponents: any;
};

export default function SectionTabs(props: SectionTabsProps) {
  // const [formsectionvalue,setformsectionvalue]=useState(0)
  const {
    sectiontabs,
    formsectionvalue,
    handelonChangeSection,
    handelonChangeLabelSection,
    formvariants,
    ...others
  } = props;

  return (
    <>
      <TabEditable
        tabs={sectiontabs}
        value={formsectionvalue}
        handleChange={handelonChangeSection}
        tab_id="sectiontab"
        handelonChangeLabel={handelonChangeLabelSection}
        tabmaxindex={
          props.formuiSpec['viewsets'][formvariants]['views'].length > 0
            ? props.formuiSpec['viewsets'][formvariants]['views'][
                props.formuiSpec['viewsets'][formvariants]['views'].length - 1
              ].replace(formvariants + 'SECTION', '')
            : 0
        }
      />
      {props.formuiSpec['viewsets'][formvariants]['views'].map(
        (sectiontab: string, index: number) =>
          props.formuiSpec['views'][sectiontab]['isdeleted'] !== true && (
            <TabPanel
              value={formsectionvalue}
              index={index}
              tabname="sectiontab"
              key={'sectiontab' + index}
            >
              <SectionTab
                formvariants={formvariants}
                formsectionvalue={formsectionvalue}
                {...others}
              />
            </TabPanel>
          )
      )}
    </>
  );
}
