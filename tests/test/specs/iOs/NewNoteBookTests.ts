import {userFixture} from "../../../fixture/User";
import WelcomePage from "../../../pages/iOs/WelcomePage";
import MenuFragment from "../../../pages/iOs/MenuFragment";
import NewNoteBookPage from "../../../pages/iOs/NewNoteBookPage";
import {newNoteBookFixture} from "../../../fixture/newNoteBook";
import * as assert from "assert";
import SignInPage from "../../../pages/SignInPage";
import {scrollDown, scrollUp} from "../../utils/scroll";
require('dotenv').config()
const deviceName = process.env.DEVICE_NAME
describe("Create New Note Book", () => {

        it("New noteBook", async () => {
            await MenuFragment.menuButtonClick()
            await MenuFragment.menuButtonNewNoteBookClick()
            await MenuFragment.menuButtonReturnClick()

            await NewNoteBookPage.projectNameSendValue(newNoteBookFixture.projectName)
            await NewNoteBookPage.descriptionSendValue(newNoteBookFixture.desc)
            await NewNoteBookPage.leadSendValue(newNoteBookFixture.lead)
            await NewNoteBookPage.leadInstitutionSendValue(newNoteBookFixture.leadInstitiution)
            await NewNoteBookPage.goNextClick()

            await NewNoteBookPage.metaSendValue(newNoteBookFixture.newMeta)
            await NewNoteBookPage.metaAddClick()
            await NewNoteBookPage.goNextClick()

            await NewNoteBookPage.userRolesSendValue(newNoteBookFixture.newRole)
            await NewNoteBookPage.roleAddClick()
            await NewNoteBookPage.goNextClick()

            await NewNoteBookPage.imageDropClick()
            await NewNoteBookPage.imageLibraryDropClick()
            await NewNoteBookPage.imageLibraryFileClick()
            await NewNoteBookPage.imageLibraryAddClick()
            await NewNoteBookPage.goNextClick()

            await NewNoteBookPage.inheritAccessClick()
            if (deviceName.includes("iPhone")){
                await scrollDown()
            }

            await NewNoteBookPage.goNextClick()

            if (deviceName.includes("iPhone")){
                await scrollDown()
            }
            await NewNoteBookPage.sectionDescSendValue('Some desc')
            await NewNoteBookPage.infoTabSectionClick()
            await NewNoteBookPage.goNextClick()

            await NewNoteBookPage.inputTextFieldClick()
            if (deviceName.includes("iPhone")){
                await scrollUp()
            }
            if (await MenuFragment.menuFragmentIsDisplayed(2000)){
                await MenuFragment.menuButtonReturnClick()
            }
            if (deviceName.includes("iPhone")){
                await scrollUp()
            }
            if (await MenuFragment.menuFragmentIsDisplayed(2000)){
                await MenuFragment.menuButtonReturnClick()
            }

            await NewNoteBookPage.submitClick()
            await NewNoteBookPage.saveClick()
        });

    it("Check new notebook created", async () => {
        await MenuFragment.menuButtonClick()
        await MenuFragment.menuButtonNoteBookClick()
        assert.ok(await NewNoteBookPage.getNoteBookPresent())
        await NewNoteBookPage.noteBookAppiumClick()
        await MenuFragment.menuButtonReturnClick()
    });

    it("Refresh", async () => {
        await NewNoteBookPage.refreshClick()
    });

    it("Available inner tabs", async () => {
        await NewNoteBookPage.settingsTabClick()
        await NewNoteBookPage.infoTabClick()
        await NewNoteBookPage.recordsTabClick()
        await NewNoteBookPage.draftTabClick()
        await NewNoteBookPage.innerRecordsTabClick()
        await NewNoteBookPage.newRecordButtonClick()
    });

        before(async function () {
            //await SignInPage.pushFileToDeviceiOS()
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

        after(async  function () {
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