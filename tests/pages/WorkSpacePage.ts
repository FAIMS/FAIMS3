import Page from "./Page";

class WorkSpacePage extends Page {
    get activedTab() {
        return $('//android.widget.TabWidget/android.view.View[1]')
    }

    get availableTab() {
        return $('//android.widget.TabWidget/android.view.View[2]')
    }

    get activeButtonFirstItem() {
        return $('//android.widget.Button[@text=\'ACTIVATE\'][1]')
    }

    get activateButtonDialogCancel() {
        return $('//android.app.Dialog/android.widget.Button[1]')
    }

    get activateButtonDialogActive() {
        return $('//android.app.Dialog/android.widget.Button[2]')
    }

    get syncCheckBox() {
        return $('//android.widget.CheckBox')
    }

    get syncButtonDialogCancelLocator() {
        return $('//android.app.Dialog/android.widget.Button[1]')
    }

    get syncButtonDialogActiveLocator() {
        return $('//android.app.Dialog/android.widget.Button[2]')
    }

    get campusSurveyDemo() {
        return $('//*[@text=\'Campus Survey Demo\']')
    }

    get surveyButton() {
        return $('//*[@content-desc=\'SURVEY AREA\']')
    }

    get searchButton() {
        return $('//*[@resource-id=\'records-drafts--0\']//android.widget.Button[2]')
    }

    get searchField() {
        return $('//*[@resource-id=\'records-drafts--0\']//android.widget.EditText[1]')
    }

    get searchResult() {
        return $('//*[@text=\'Survey Area: AppiumUser\']')
    }

    get landscapeButton () {return $('//android.view.View[@content-desc="LANDSCAPE ELEMENT"]')}
    get editNoteBookButton () {return $('//android.view.View[@content-desc="EDIT NOTEBOOK DESIGN"]')}
    get resetButton () {return $('//*[@text=\'RESET\']')}
    get addNewRangeButton () {return $('//*[@text=\'ADD NEW RANGE\']')}
    get copyToClipBoardButton () {return $('//*[@text=\'COPY TO CLIPBOARD\']')}
    get discardDraftButton () {return $('//*[@text=\'DISCARD DRAFT\']')}
    get metaTabButton () {return $('//*[@text=\'META\']')}
    get createTabButton () {return $('//*[@text=\'CREATE\'][1]')}
    get syncNoteBookCheckBox () {return $('//android.widget.CheckBox[1]')}
    get getAttachmentsCheckBox () {return $('//android.widget.CheckBox[2]')}
    get getCheckBoxStatusOFF () {return $('//android.widget.CheckBox[contains(@text, \'OFF\')]')}
    get getCheckBoxStatusON () {return $('//android.widget.CheckBox[contains(@text, \'ON\')]')}


    async activedTabClick() {
        await this.activedTab.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.activedTab.click()
    }

    async availableTabClick() {
        await this.availableTab.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.availableTab.click()
    }

    async availableTabIsDisplayed(){
        await this.availableTab.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        return await this.availableTab.isDisplayed()
    }

    async checkBoxOffIsDisplayed(){
        await this.getCheckBoxStatusOFF.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        return await this.getCheckBoxStatusOFF.isDisplayed()
    }

    async checkBoxOnIsDisplayed(){
        await this.getCheckBoxStatusON.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        return await this.getCheckBoxStatusON.isDisplayed()
    }

    async activeFirstElementClick(){
        await this.activeButtonFirstItem.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.activeButtonFirstItem.click()
    }

    async dialogActiveClick(){
        await this.activateButtonDialogActive.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.activateButtonDialogActive.click()
    }

    async dialogCancelClick(){
        await this.activateButtonDialogCancel.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.activateButtonDialogCancel.click()
    }

    async searchFieldSendValue(search:string){
        await this.searchField.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.searchField.setValue(search)
    }

    async searchButtonClick(){
        await this.searchButton.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.searchButton.click()
    }

    async campusButtonClick(){
        await this.campusSurveyDemo.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.campusSurveyDemo.click()
    }

    async syncCheckBoxClick(){
        await this.syncCheckBox.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.syncCheckBox.click()
    }
}

export default new WorkSpacePage()