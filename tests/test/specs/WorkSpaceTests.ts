import MenuFragment from "../../pages/MenuFragment";
import WorkSpacePage from "../../pages/WorkSpacePage";
import * as assert from "assert";
import WelcomePage from "../../pages/WelcomePage";
import SignInPage from "../../pages/SignInPage";
import {userFixture} from "../../fixture/User";

describe("WorkSpace Suite", () => {
    it('Check workspace', async () => {
        await MenuFragment.menuButtonClick()
        await MenuFragment.workSpaceButtonClick()
        await MenuFragment.backMenuButtonClick()

        await WorkSpacePage.availableTabClick()
        await WorkSpacePage.activedTabClick()

        assert.ok(await WorkSpacePage.availableTabIsDisplayed(), 'Workspaces tab not presented')
    })

    it('Sync On Campus', async () => {
        await MenuFragment.menuButtonClick()
        await MenuFragment.workSpaceButtonClick()
        await MenuFragment.backMenuButtonClick()

        await WorkSpacePage.availableTabClick()
        await WorkSpacePage.activeFirstElementClick()
        await WorkSpacePage.dialogActiveClick()
        assert.ok(await WorkSpacePage.checkBoxOnIsDisplayed(),'Sync not ON')
    })

    it('Sync Off Campus', async () => {
        await MenuFragment.menuButtonClick()
        await MenuFragment.workSpaceButtonClick()
        await MenuFragment.backMenuButtonClick()
        await WorkSpacePage.syncCheckBoxClick()
        await WorkSpacePage.dialogActiveClick()
        assert.ok(await WorkSpacePage.checkBoxOffIsDisplayed(),'Sync not OFF')
    })

    before(async function() {
        await SignInPage.pushFileToDevice()
        if (!userFixture.isLocal){
        let name = this.test.parent.title
        const executorConfigName = {
            "action": "setSessionName",
            "arguments": {
                "name": name
            }
        };
        await driver.execute('browserstack_executor: ' + JSON.stringify(executorConfigName));}

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
})