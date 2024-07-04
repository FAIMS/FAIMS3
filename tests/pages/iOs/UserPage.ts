import Page from "../Page";
class UserPage extends Page{
    get currentUser () {return $('//XCUIElementTypeStaticText[@name="CURRENT USER"]')}
    get workspaceButton () {return $('//XCUIElementTypeButton[@name="WORKSPACE"]')}
    get switchButton () {return $('//XCUIElementTypeButton[@name="SWITCH"]')}
    get logOutButton () {return $('//XCUIElementTypeButton[@name="LOG OUT"]')}
    get addAnotherUserButton () {return $('//XCUIElementTypeButton[@name="ADD ANOTHER USER"]')}
    get refreshButton () {return $('//XCUIElementTypeButton[@name="REFRESH"]')}

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