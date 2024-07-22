import UserPage from "../../pages/UserPage";
import * as assert from "assert";
import MenuFragment from "../../pages/MenuFragment";
import WelcomePage from "../../pages/WelcomePage";
import SignInPage from "../../pages/SignInPage";
import {userFixture} from "../../fixture/User";
import WorkSpacePage from "../../pages/WorkSpacePage";
import menuFragment from "../../pages/MenuFragment";

describe("User suite", () => {

    it('User check page', async () => {
        await MenuFragment.menuButtonClick()
        await MenuFragment.userButtonClick()
        await MenuFragment.backMenuButtonClick()

        assert.ok(await UserPage.getCurrentUserIsDisplayed(), "Current user not presented")
    })

    it('Work space check', async () => {
        await UserPage.workspaceButtonClick()
        assert.ok(await WorkSpacePage.availableTabIsDisplayed(), "Work space not presented")
    })

    it('Switch check', async () => {
        await MenuFragment.menuButtonClick()
        await MenuFragment.userButtonClick()
        await MenuFragment.backMenuButtonClick()

        await UserPage.switchButtonClick()
        await WelcomePage.signInButtonClick()
        await WelcomePage.returnAppButtonClick()
        assert.ok(await UserPage.getCurrentUserIsDisplayed(), "Current user not presented")
    })

    it('Refresh check', async () => {
        await UserPage.refreshButtonClick()
        await WelcomePage.returnAppButtonClick()
        assert.ok(await UserPage.getCurrentUserIsDisplayed(), "Current user not presented")
    })

    it('LogOut check', async () => {
        await UserPage.logOutButtonClick()
        assert.ok(await WelcomePage.signInButtonIsDisplayed(), "Successfully log out")
    })


    before(async function () {
        if (!userFixture.isLocal){
        let name = this.test.parent.title
        const executorConfigName = {
            "action": "setSessionName",
            "arguments": {
                "name": name
            }
        };
        await driver.execute('browserstack_executor: ' + JSON.stringify(executorConfigName));
        }
        const contexts = await driver.getContexts(); // get list of context
        await driver.switchContext(contexts[0].toString()); // set context to APP_NATIVE
        await WelcomePage.signInHomeButtonClick()
        await WelcomePage.signInButtonClick()

        if (!userFixture.isLocal){
            if (await WelcomePage.webViewButtonIsDisplayed(3000)){
                await WelcomePage.chromeChoseClick()
                await WelcomePage.alwaysClick()
            }
        }

        if (await WelcomePage.logOutButtonIsDisplayed(10000)){
            await WelcomePage.logOutButtonClick()
            await SignInPage.signInLocal()
        }else {
            await SignInPage.signInLocal()
        }
    });

    after(async function () {
        await SignInPage.pushFileToDevice()
        if (!userFixture.isLocal){
        let state = this.currentTest.state
        const executorConfig = {
            "action": "setSessionStatus",
            "arguments": {
                "status": state
            },
        };
        await driver.execute('browserstack_executor: ' + JSON.stringify(executorConfig));}
    });
});