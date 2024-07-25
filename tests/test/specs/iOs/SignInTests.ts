import WelcomePage from "../../../pages/iOs/WelcomePage";
import {userFixture} from "../../../fixture/User";
import MenuFragment from "../../../pages/iOs/MenuFragment";
import * as assert from "assert";

describe("Sign in Test Suite", async () => {

    it("sign-in", async () => {
        await WelcomePage.signInHomeButtonClick()
        await WelcomePage.signInButtonClick()
        await WelcomePage.signInLocal()
    });

    it("Check menu", async () => {
        await MenuFragment.menuButtonClick()
        await MenuFragment.menuButtonReturnClick()
    });

    it("Check home return", async () => {
        await MenuFragment.menuButtonClick()
        await MenuFragment.menuButtonHomeClick()
        await MenuFragment.menuButtonReturnClick()
    });

    before(async function () {
        const contexts = await driver.getContexts(); // get list of context
        await driver.switchContext(contexts[0].toString()); // set context to APP_NATIVE

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
    })

    after(async function () {
        if (!userFixture.isLocal){
            let state = this.currentTest.state
            const executorConfig = {
                "action": "setSessionStatus",
                "arguments": {
                    "status": state
                },
            };
            await driver.execute('browserstack_executor: ' + JSON.stringify(executorConfig));
        }
    });

});