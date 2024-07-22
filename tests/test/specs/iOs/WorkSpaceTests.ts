import * as assert from "assert";
import MenuFragment from "../../../pages/iOs/MenuFragment";
import WorkSpacePage from "../../../pages/iOs/WorkSpacePage";
import WelcomePage from "../../../pages/iOs/WelcomePage";
import {userFixture} from "../../../fixture/User";
import {tapByCoordinates, tapByCoordinatesIOS} from "../../utils/scroll";

describe("WorkSpace Suite", () => {
    it('Check workspace', async () => {
        await MenuFragment.menuButtonClick()
        await MenuFragment.menuButtonWorkspaceClick()
        await MenuFragment.menuButtonReturnClick()

        await WorkSpacePage.availableTabClick()
        await WorkSpacePage.activedTabClick()

        assert.ok(await WorkSpacePage.availableTabIsDisplayed(), 'Workspaces tab not presented')
    })

    it('Sync On Campus', async () => {
        await MenuFragment.menuButtonClick()
        await MenuFragment.menuButtonWorkspaceClick()
        await MenuFragment.menuButtonReturnClick()

        await tapByCoordinatesIOS()
        await tapByCoordinatesIOS()
        await WorkSpacePage.activeFirstElementClick()
        await WorkSpacePage.dialogActiveClick()
        assert.ok(await WorkSpacePage.checkBoxOnIsDisplayed(),'Sync not ON')
    })

    it('Sync Off Campus', async () => {
        await MenuFragment.menuButtonClick()
        await MenuFragment.menuButtonWorkspaceClick()
        await MenuFragment.menuButtonReturnClick()

        await tapByCoordinatesIOS()
        await WorkSpacePage.syncCheckBoxClick()
        await WorkSpacePage.stopSyncClick()
        assert.ok(await WorkSpacePage.checkBoxOffIsDisplayed(),'Sync not OFF')
    })

    before(async function() {
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
})