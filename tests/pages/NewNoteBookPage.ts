import Page from "./Page";

class NewNoteBookPage extends Page{
    /*New NoteBook first step*/
    get projectNameField () {return $('//*[@resource-id=\'name\']')}
    get descriptionField () {return $('//*[@resource-id=\'pre_description\']')}
    get leadField () {return $('//*[@resource-id=\'project_lead\']')}
    get leadInstitution () {return $('//*[@resource-id=\'lead_institution\']')}
    get primaryTab () {return $('//*[@resource-id=\'primarytab-1\']')}
    get goNextButton () {return $('//android.widget.Button[@text=\'GO TO NEXT\']')}

    /*Meta*/
    get metaField(){return $('//*[@resource-id=\'metaadd\']')}
    get metaAddButton(){return $('//*[@resource-id=\'AddMetaButton\']')}
    get userRoles(){return $('//*[@resource-id=\'accessadded\']')}
    get addUserRolesButton(){return $('//*[@resource-id=\'AddUserRoleButton\']')}

    /*Attachment*/
    get attachField(){return $('//*[@resource-id=\'gotonext_info\']/../android.view.View[1]')}
    get imageSearch(){return $('//*[@text=\'Images\']')}
    get imageRoot() {return $('//*[@resource-id=\'com.google.android.documentsui:id/dir_list\']/*')}
    get goNextIdButton() { return $('//*[@resource-id=\'gotonext_info\']')}

    /*Sections*/
    get checkBoxAccess(){return $('//*[@resource-id=\'formaccessinheritFORM1\']')}
    get descriptionSection(){return $('//*[@resource-id=\'sectiondescriptionFORM1SECTION1\']')}
    get supportFooterText(){return $('//android.widget.TextView[@text=\'Support:\']')}
    get textFieldSection(){return $('//android.widget.Button[@text=\'Input field text plus special characters\']')}
    get submitButton(){return $('//*[@resource-id=\'primarytab-5\']')}
    get formTabAccess(){return $('//*[@resource-id=\'formtab-0\']')}
    get submitSave(){return $('//*[@resource-id=\'submit_save\']')}
    get inputBoxMultipleSectionButton(){return $('//android.widget.Button[@text=\'Input Box Multiple line Input Box\']')}
    get selectSectionButton(){return $('//android.widget.Button[@text=\'Select Select one item\']')}
    get multiSelectSectionButton(){return $('//android.widget.Button[@text=\'MultiSelect Select multiple items\']')}
    get hierarchicalSelectSectionButton(){return $('//android.widget.Button[@text=\'Hierarchical Select Hierarchical vocabularies pick\']')}
    get checkBoxSectionButton(){return $('//android.widget.Button[@text=\'Checkbox Checkbox\']')}
    get radioSectionButton(){return $('//android.widget.Button[@text=\'Radio Radio\']')}
    get actionSectionButton(){return $('//android.widget.Button[@text=\'Action Button Do an action\']')}
    get takePointSectionButton(){return $('//android.widget.Button[@text=\'Take Point\']')}
    get uniqueIdSectionButton(){return $('//android.widget.Button[@text=\'Unique ID Build a value up from other fields\']')}
    get autoIncrementerSectionButton(){return $('//android.widget.Button[@text=\'Basic AutoIncrementer A basic autoincrementer to help create identifiers\']')}
    get relatedFieldSectionButton(){return $('//android.widget.Button[@text=\'Related field Add relations between records\']')}
    get fileUploadSectionButton(){return $('//android.widget.Button[@text=\'File Upload Upload File\']')}
    get titleSubTitleSectionButton(){return $('//android.widget.Button[@text=\'Title a sub Title for part\']')}
    get dateTimeNowSectionButton(){return $('//android.widget.Button[@text=\'DateTimeNow TZ-aware DateTime field with Now button\']')}
    get takePhotoSectionButton(){return $('//android.widget.Button[@text=\'Take Photo Take Photo\']')}
    get qrCodeSectionButton(){return $('//android.widget.Button[@text=\'QR Code Scanning Scan a QR/Bar code\']')}
    get mapInputSectionButton(){return $('//android.widget.Button[@text=\'Map Input Field Input Geo Data via a map\']')}

    async projectNameSendValue(projectName:string){
        await this.projectNameField.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.projectNameField.setValue(projectName)
    }

    async descriptionSendValue(description:string){
        await this.descriptionField.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.descriptionField.setValue(description)
    }

    async leadSendValue(lead:string){
        await this.leadField.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.leadField.setValue(lead)
    }

    async leadInstitutionSendValue(leadInstitution:string){
        await this.leadInstitution.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.leadInstitution.setValue(leadInstitution)
    }

    async primaryTabGetText(){
        await this.primaryTab.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        return await this.primaryTab.getText()
    }

    async goNextClick(){
        await this.goNextButton.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.goNextButton.click()
    }

    async metaFieldSendValue(meta:string){
        await this.metaField.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.metaField.setValue(meta)
    }

    async metaAddButtonClick(){
        await this.metaAddButton.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.metaAddButton.click()
    }

    async userRoleSendValue(userRole:string){
        await this.userRoles.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.userRoles.setValue(userRole)
    }
    async userAddButtonClick(){
        await this.addUserRolesButton.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.addUserRolesButton.click()
    }

    async supportTextClick(){
        await this.supportFooterText.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.supportFooterText.click()
    }

    async formTabClick(){
        await this.formTabAccess.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.formTabAccess.click()
    }

    async attachFieldClick(){
        await this.attachField.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.attachField.click()
    }

    async imageSearchClick(){
        await this.imageSearch.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.imageSearch.click()
    }

    async imageRootChoiceFile(){
        await this.imageRoot.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.imageRoot.click()
    }

    async goNextIdButtonClick(){
        await this.goNextIdButton.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.goNextIdButton.click()
    }

    async inheritCheckBoxClick(){
        await this.checkBoxAccess.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.checkBoxAccess.click()
    }

    async descriptionSectionSendValue(desc:string){
        await this.descriptionSection.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.descriptionSection.setValue(desc)
    }

    async inputTextFieldSection(){
        await this.textFieldSection.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.textFieldSection.click()
    }

    async submitButtonClick(){
        await this.submitButton.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.submitButton.click()
    }

    async submitSaveButtonClick(){
        await this.submitSave.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.submitSave.click()
    }
}

export default new NewNoteBookPage()