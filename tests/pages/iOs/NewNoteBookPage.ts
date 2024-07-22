import Page from "../Page";
import {scrollUp} from "../../test/utils/scroll";
const deviceName = process.env.DEVICE_NAME

class UserPage extends Page {
    get projectNameField() {
        return $('//XCUIElementTypeStaticText[@name="Project Name"]/../..//XCUIElementTypeTextField')
    }

    get descriptionField() {
        return $('//XCUIElementTypeStaticText[@name="Description"]/../..//XCUIElementTypeTextView')
    }

    get leadField() {
        return $('//XCUIElementTypeStaticText[@name="Lead"]/../..//XCUIElementTypeTextField')
    }

    get leadInstitution() {
        return $('//XCUIElementTypeStaticText[@name="lead_institution"]/../..//XCUIElementTypeTextField')
    }

    get goNextButton() {
        return $('//XCUIElementTypeButton[@name="GO TO NEXT"]')
    }

    get metaField() {
        return $('//XCUIElementTypeStaticText[@name="Add new meta data Label"]/../../XCUIElementTypeTextField')
    }

    get metaRolesAdd() {
        return $('//XCUIElementTypeButton[@name="ADD"]')
    }

    get userRoles() {
        return $('//XCUIElementTypeStaticText[@name="Add User Roles"]/../../XCUIElementTypeTextField')
    }

    get imageDrop() {
        return $('//XCUIElementTypeStaticText[@name="Drag \'n\' drop some files here, or click to select files"]')
    }

    get imageLibraryDrop() {
        return $('//XCUIElementTypeButton[@name="Photo Library"]')
    }

    get imageFromLibrary() {
        return $('//XCUIElementTypeImage[2]')
    }

    get imageFromLibraryAdd() {
        return $('//XCUIElementTypeButton[@name="Add"]')
    }

    get inheritAccess() {
        return $('//XCUIElementTypeStaticText[@name="Inherit Access from Notebook"]')
    }

    get descriptionSection() {
        return $('//XCUIElementTypeStaticText[@name="Description"]/../..//XCUIElementTypeTextView')
    }

    get inputTextField() {
        return $('//XCUIElementTypeOther[@name="COMPONENT, tab panel"]/XCUIElementTypeButton[2]')
    }

    get submitNoteBookTab() {
        return $('//XCUIElementTypeButton[@name="SUBMIT"]')
    }

    get saveNoteBookTab() {
        return $('//XCUIElementTypeButton[@name="SAVE NOTEBOOK"]')
    }

    get noteBookNameAppium() {
        return $('//XCUIElementTypeLink[@name="Appium Testing Notebook"]')
    }

    get refreshNoteBook() {
        return $('//XCUIElementTypeButton[@name="REFRESH"]')
    }

    get infoTabNoteBook() {
        return $('//XCUIElementTypeButton[@name="INFO"]')
    }

    get settingsTabNoteBook() {
        return $('//XCUIElementTypeButton[@name="SETTINGS"]')
    }

    get recordsTabNoteBook() {
        return $('(//XCUIElementTypeButton[@name="RECORDS"])[1]')
    }

    get draftsInnerTabNoteBook() {
        return $('//XCUIElementTypeButton[@name="DRAFTS"]')
    }

    get recordsInnerTabNoteBook() {
        return $('(//XCUIElementTypeButton[@name="RECORDS"])[1]')
    }
    get newRecordButton() {
        return $('//XCUIElementTypeLink[@name="NEW RECORD"]')
    }

    get generalTab() {
        return $('//XCUIElementTypeButton[@name="GENERAL"]')
    }

    get metaTab() {
        return $('//XCUIElementTypeButton[@name="META"]')
    }

    get userRoleTab() {
        return $('//XCUIElementTypeButton[@name="USER ROLE"]')
    }
    get infoTab() {
        return $('(//XCUIElementTypeButton[@name="INFO"])[2]')
    }

    async infoTabSectionClick() {
        await this.infoTab.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.infoTab.click()
    }
    async generalTabClick() {
        await this.generalTab.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.generalTab.click()
    }

    async metaTabClick() {
        await this.metaTab.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.metaTab.click()
    }

    async userRoleTabClick() {
        await this.userRoleTab.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.userRoleTab.click()
    }

    async projectNameSendValue(projectName: string) {
        await this.projectNameField.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.projectNameField.setValue(projectName)
        if (!deviceName.includes("iPhone")){
            await this.closeKeyboard()
        }else {
            await this.generalTabClick()
        }
    }

    async descriptionSendValue(description: string) {
        await this.descriptionField.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.descriptionField.setValue(description)
        if (!deviceName.includes("iPhone")){
            await this.closeKeyboard()
        }else {
            await this.generalTabClick()
        }
    }

    async leadSendValue(lead: string) {
        await this.leadField.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.leadField.setValue(lead)
        if (!deviceName.includes("iPhone")){
            await this.closeKeyboard()
        }
    }

    async leadInstitutionSendValue(leadInstitution: string) {
        await this.leadInstitution.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.leadInstitution.setValue(leadInstitution)
        if (!deviceName.includes("iPhone")){
            await this.closeKeyboard()
        }else {
            await this.leadInstitution.click()
        }
    }

    async goNextClick() {
        await this.goNextButton.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.goNextButton.click()
    }

    async metaSendValue(lead: string) {
        await this.metaField.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.metaField.setValue(lead)
        if (!deviceName.includes("iPhone")){
            await this.closeKeyboard()
        }
    }

    async metaAddClick() {
        await this.metaRolesAdd.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.metaRolesAdd.click()
    }

    async userRolesSendValue(role: string) {
        await this.userRoles.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.userRoles.setValue(role)
        if (!deviceName.includes("iPhone")){
            await this.closeKeyboard()
        }
    }

    async roleAddClick() {
        await this.metaRolesAdd.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.metaRolesAdd.click()
    }

    async imageDropClick() {
        await this.imageDrop.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.imageDrop.click()
    }

    async imageLibraryDropClick() {
        await this.imageLibraryDrop.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.imageLibraryDrop.click()
    }

    async imageLibraryFileClick() {
        await this.imageFromLibrary.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.imageFromLibrary.click()
    }

    async imageLibraryAddClick() {
        await this.imageFromLibraryAdd.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.imageFromLibraryAdd.click()
    }

    async inheritAccessClick() {
        await this.inheritAccess.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.inheritAccess.click()
    }

    async sectionDescSendValue(desc: string) {
        await this.descriptionSection.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.descriptionSection.setValue(desc)
        if (!deviceName.includes("iPhone")){
            await this.closeKeyboard()
        }
    }

    async inputTextFieldClick() {
        await this.inputTextField.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.inputTextField.click()
    }

    async submitClick() {
        await this.submitNoteBookTab.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.submitNoteBookTab.click()
    }

    async saveClick() {
        await this.saveNoteBookTab.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.saveNoteBookTab.click()
    }

    async getNoteBookPresent(){
        await this.noteBookNameAppium.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        return await this.noteBookNameAppium.isDisplayed()
    }

    async noteBookAppiumClick() {
        await this.noteBookNameAppium.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.noteBookNameAppium.click()
    }

    async refreshClick() {
        await this.refreshNoteBook.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.refreshNoteBook.click()
    }

    async infoTabClick() {
        await this.infoTabNoteBook.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.infoTabNoteBook.click()
    }

    async settingsTabClick() {
        await this.settingsTabNoteBook.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.settingsTabNoteBook.click()
    }

    async recordsTabClick() {
        await this.recordsTabNoteBook.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.recordsTabNoteBook.click()
    }

    async draftTabClick() {
        await this.draftsInnerTabNoteBook.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.draftsInnerTabNoteBook.click()
    }

    async innerRecordsTabClick() {
        await this.recordsInnerTabNoteBook.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.recordsInnerTabNoteBook.click()
    }

    async newRecordButtonClick() {
        await this.newRecordButton.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.newRecordButton.click()
    }

}

export default new UserPage()