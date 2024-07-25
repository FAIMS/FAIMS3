import Page from "./Page";
import WelcomePage from "./WelcomePage";
import {userFixture} from "../fixture/User";

class SignInPage extends Page{
     get usernameField () {return $('//*[@resource-id=\'InputIdentifier\']')}
     get passwordField () {return $('//*[@resource-id=\'InputPassword\']')}
    get submitButton () {return $('//*[@text=\'Submit\']')}

    get continueButton () {return $('//*[@text=\'Continue\']')}

    async usernameSendValue(username:string){
        await this.usernameField.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.usernameField.setValue(username)
    }

    async usernameIsDisplayed(){
        await driver.pause(3000)
        return await this.usernameField.isDisplayed()
    }

    async passwordSendValue(password:string){
        await this.passwordField.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.passwordField.setValue(password)
    }
    async submitClick(){
        await this.submitButton.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.submitButton.click()
    }

    async continueClick(){
        await this.continueButton.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.continueButton.click()
    }

    async signInLocal(){
            await this.usernameSendValue(userFixture.login)
            await this.passwordSendValue(userFixture.pass)
            await this.submitClick()
    }
}

export default new SignInPage()