import Page from "./Page";

class NoteBookPage extends Page{
    get recordsTab () {return $('//*[@resource-id=\'notebook-tab-0\']')}
    get infoTab () {return $('//*[@resource-id=\'notebook-tab-1\']')}
    get settingsTab () {return $('//*[@resource-id=\'notebook-tab-2\']')}
    get recordsNoteBook () {return $('//*[@resource-id=\'notebook-records-tab-0\']')}
    get draftsNoteBook () {return $('//*[@resource-id=\'notebook-records-tab-1\']')}
    get refreshButton () {return $('//android.widget.Button[@text=\'REFRESH\']')}
    get newRecordButton () {return $('//android.view.View[@content-desc="NEW RECORD"]')}

    async newRecordButtonClick(){
        await this.newRecordButton.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.newRecordButton.click()
    }

    async recordsTabClick(){
        await this.recordsTab.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.recordsTab.click()
    }

    async infoTabClick(){
        await this.infoTab.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.infoTab.click()
    }

    async settingsTabClick(){
        await this.settingsTab.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.settingsTab.click()
    }

    async draftsClick(){
        await this.draftsNoteBook.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.draftsNoteBook.click()
    }

    async recordsClick(){
        await this.recordsNoteBook.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.recordsNoteBook.click()
    }

    async refreshButtonClick(){
        await this.refreshButton.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.refreshButton.click()
    }
}

export default new NoteBookPage()