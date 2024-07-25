import MenuFragment from "../../../pages/iOs/MenuFragment";
import * as assert from "assert";
import UserPage from "../../../pages/iOs/UserPage";
import WorkSpacePage from "../../../pages/iOs/WorkSpacePage";
import WelcomePage from "../../../pages/iOs/WelcomePage";
import {userFixture} from "../../../fixture/User";


describe("User suite", () => {

    it('User check page', async () => {
        await MenuFragment.menuButtonClick()
        await MenuFragment.menuButtonUserClick()
        await MenuFragment.menuButtonReturnClick()

        assert.ok(await UserPage.getCurrentUserIsDisplayed(), "Current user not presented")
    })

    it('Work space check', async () => {
        await UserPage.workspaceButtonClick()
        assert.ok(await WorkSpacePage.availableTabIsDisplayed(), "Work space not presented")
    })

    it('Switch check', async () => {
        await MenuFragment.menuButtonClick()
        await MenuFragment.menuButtonUserClick()
        await MenuFragment.menuButtonReturnClick()

        await UserPage.switchButtonClick()
        await WelcomePage.signInButtonClick()
        await WelcomePage.returnClick()
        await WelcomePage.doneClick()
        assert.ok(await UserPage.getCurrentUserIsDisplayed(), "Current user not presented")
    })

    it('Refresh check', async () => {
        await UserPage.refreshButtonClick()
        await WelcomePage.returnClick()
        await WelcomePage.doneClick()
        assert.ok(await UserPage.getCurrentUserIsDisplayed(), "Current user not presented")
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
        await WelcomePage.signInLocal()
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
});