import Page from "./Page";

class UserPage extends Page{
    get currentUser () {return $('//*[@text=\'CURRENT USER\']')}
    get workspaceButton () {return $('//*[@text=\'WORKSPACE\']')}
    get switchButton () {return $('//*[@text=\'SWITCH\']')}
    get logOutButton () {return $('//android.widget.Button[contains(@text, \'LOG\')]')}
    get addAnotherUserButton () {return $('//*[@text=\'ADD ANOTHER USER\']')}
    get refreshButton () {return $('//*[@text=\'REFRESH\']')}

    async getCurrentUserText(){
        await this.currentUser.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        return await this.currentUser.getText()
    }

    async getCurrentUserIsDisplayed(){
        await this.currentUser.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        return await this.currentUser.isDisplayed()
    }

    async workspaceButtonClick(){
        await this.workspaceButton.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.workspaceButton.click()
    }

    async switchButtonClick(){
        await this.switchButton.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.switchButton.click()
    }

    async addAnotherUserButtonClick(){
        await this.addAnotherUserButton.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.addAnotherUserButton.click()
    }

    async refreshButtonClick(){
        await this.refreshButton.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.refreshButton.click()
    }

    async logOutButtonClick(){
        await this.logOutButton.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.logOutButton.click()
    }
}

export default new UserPage()