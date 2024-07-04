import {readFileSync} from 'fs';
import {join} from "path";

export default class Page{
    private title: string;
    get idRoot () {return $('//android.view.View[@resource-id=\'root\']')}
    get clickOutsideKeyboard () {return $('//XCUIElementTypeStaticText[@name="PROVIDER"]')}

    constructor() {
        this.title = 'My Page'
    }

    async open(path) {
        await browser.url(path)
    }

    async getWaiterTimeForElement(){
        return 75000;
    }

    async pushFileToDevice(){
        const codingBot = readFileSync(join(process.cwd(), 'test/utils/sc1.png'), 'base64');
        await driver.pushFile('/sdcard/Pictures/sc1.png', codingBot);
    }

    async pushFileToDeviceiOS(){
        const codingBot = readFileSync(join(process.cwd(), 'test/utils/sc1.png'), 'base64');
        await driver.pushFile('Root/User/Media/Photos/Thumbs', codingBot);
    }

    async closeKeyboard(){
        if (await driver.isKeyboardShown()) {
            await driver.hideKeyboard()
        }
    }

    async waitElementAndClick(element: WebdriverIO.Element) {
        await element.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await element.click()
    }

    async isElementPresent(element: WebdriverIO.Element): Promise<boolean> {
        return await element.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
    }

    async waitElementAndGetText(element: WebdriverIO.Element) {
        await element.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        return await element.getText()
    }

    async waitElementAndSendKeys(element: WebdriverIO.Element, keys: string) {
        await element.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await element.setValue(keys)
    }

    async scrollToElement(element: WebdriverIO.Element){
        await driver.touchAction([
            { action: 'moveTo',element: element},
            'release'
        ])
    }

}