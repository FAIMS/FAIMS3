import Page from "../Page";
import {userFixture} from "../../fixture/User";
import {scrollDown, tapByCoordinates, tapByCoordinatesXY} from "../../test/utils/scroll";
const deviceName = process.env.DEVICE_NAME

class WelcomePage extends Page {

    get signInHomeButtoniOs() {
        return $('(//XCUIElementTypeLink[@name="SIGN IN"])[2]')
    }

    get signInButton() {
        return $('//XCUIElementTypeButton[@name="SIGN IN"]')
    }

    get neverSaveDialog() {
        return $('//XCUIElementTypeButton[@name="Never for This Website"]')
    }

    get doneBrowser() {
        return $('//XCUIElementTypeButton[@name="Done"]')
    }


    get usernameField() {
        return $('(//XCUIElementTypeOther[@name="main"])[1]/XCUIElementTypeTextField')
    }

    get passwordField() {
        return $('(//XCUIElementTypeOther[@name="main"])[1]/XCUIElementTypeSecureTextField')
    }

    get submitButton() {
        return $('//XCUIElementTypeButton[@name="Submit"]')
    }

    get returnToApp() {
        return $('//XCUIElementTypeLink[@name="Return to App "]')
    }

    get logOut() {
        return $('//XCUIElementTypeLink[@name="Log Out of App "]')
    }

    async signInLocal() {
        await this.usernameSendValue(userFixture.login)
        await tapByCoordinatesXY(200,360)
        await this.passwordSendValue(userFixture.pass)
        await tapByCoordinatesXY(200,360)
        await this.submitClick()

        if(!userFixture.isLocal){
            await this.neverSaveClick()
        }else {
            await this.doneClick()
        }
    }

    async usernameSendValue(username: string) {
        await this.usernameField.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.usernameField.setValue(username)
        if (!deviceName.includes("iPhone")){
            await this.closeKeyboard()
        }
    }

    async passwordSendValue(password: string) {
        await this.passwordField.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.passwordField.setValue(password)
        if (!deviceName.includes("iPhone")){
            await this.closeKeyboard()
        }
    }

    async submitClick() {
        await this.submitButton.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.submitButton.click()
    }

    async neverSaveClick() {
        await this.neverSaveDialog.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.neverSaveDialog.click()
    }

    async doneClick() {
        await this.doneBrowser.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.doneBrowser.click()
    }

    async returnClick() {
        await this.returnToApp.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.returnToApp.click()
    }

    async logOutClick() {
        await this.logOut.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.logOut.click()
    }

    async signInHomeButtonClick() {
        await this.signInHomeButtoniOs.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.signInHomeButtoniOs.click()
    }

    async signInButtonClick() {
        await this.signInButton.waitForDisplayed({timeout: await this.getWaiterTimeForElement()})
        await this.signInButton.click()
    }
}

export default new WelcomePage()