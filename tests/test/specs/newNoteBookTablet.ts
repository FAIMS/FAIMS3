import {newNoteBookFixture} from "../../fixture/newNoteBook";
import {scrollDown, scrollUp, tapByCoordinates} from "../utils/scroll";
import * as assert from "assert";
import MenuFragment from "../../pages/MenuFragment";
import NewNoteBookPage from "../../pages/NewNoteBookPage";
import WelcomePage from "../../pages/WelcomePage";
import NoteBookPage from "../../pages/NoteBookPage";
import SignInPage from "../../pages/SignInPage";
import {userFixture} from "../../fixture/User";

describe("Create New Note Book", () => {

    it("sign-in with pass", async () => {
        await MenuFragment.menuButtonClick()

        await MenuFragment.newNoteBookButtonClick()

        await MenuFragment.backMenuButtonClick()

        assert.equal(await NewNoteBookPage.primaryTabGetText(), 'DESIGN', 'Tabs not presented')
    });

    it("New noteBook", async () => {
        await scrollDown()

        await NewNoteBookPage.projectNameSendValue(newNoteBookFixture.projectName)
        await NewNoteBookPage.descriptionSendValue(newNoteBookFixture.desc)
        await NewNoteBookPage.leadSendValue(newNoteBookFixture.lead)
        await NewNoteBookPage.leadInstitutionSendValue(newNoteBookFixture.leadInstitiution)

        await NewNoteBookPage.goNextClick()

        await NewNoteBookPage.metaFieldSendValue(newNoteBookFixture.newMeta)
        await NewNoteBookPage.metaAddButtonClick()

        await scrollDown()

        await NewNoteBookPage.goNextClick()

        await NewNoteBookPage.userRoleSendValue(newNoteBookFixture.newRole)
        await NewNoteBookPage.userAddButtonClick()

        await scrollDown()

        await NewNoteBookPage.goNextClick()

        await NewNoteBookPage.attachFieldClick()
        await NewNoteBookPage.imageSearchClick()
        await NewNoteBookPage.imageRootChoiceFile()
        await scrollDown()
        await scrollDown()

        await NewNoteBookPage.goNextIdButtonClick()

        await tapByCoordinates()
        await NewNoteBookPage.inheritCheckBoxClick()
        await NewNoteBookPage.goNextIdButtonClick()


        await scrollDown()
        await NewNoteBookPage.descriptionSectionSendValue('Some desc')

        await NewNoteBookPage.goNextIdButtonClick()
        await NewNoteBookPage.inputTextFieldSection()
        await scrollUp()
        await scrollUp()

        await NewNoteBookPage.submitButtonClick()
        await NewNoteBookPage.submitSaveButtonClick()

        await MenuFragment.menuButtonClick()
        await MenuFragment.notebooksButtonClick()
        assert.equal(await MenuFragment.getProjectNameFromNoteBook(), newNoteBookFixture.projectName, 'Incorrect project name')
        await MenuFragment.backMenuButtonClick()
    });

    it('new Record', async () => {
        await MenuFragment.menuButtonClick()
        await MenuFragment.projectNameFromNoteBookClick()
        await MenuFragment.backMenuButtonClick()

        await NoteBookPage.infoTabClick()
        await NoteBookPage.settingsTabClick()
        await NoteBookPage.recordsTabClick()

        await NoteBookPage.draftsClick()
        await NoteBookPage.recordsClick()
    })

    it('Refresh notebook', async () => {
        await NoteBookPage.refreshButtonClick()
    })

    it('New record page opened', async () => {
        await NoteBookPage.newRecordButtonClick()
        // TODO impl when app was fixed
    })

    before(async function () {
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