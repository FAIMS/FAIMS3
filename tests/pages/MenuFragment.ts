import Page from "./Page";

class MenuFragment extends Page{
    get menuButton () {return $('//android.widget.Button[@text=\'open drawer\']')}
    get newNoteBookMenu (){return $('//android.widget.TextView[@text=\'New Notebook\']')}
    get userMenu (){return $('//android.widget.TextView[@text=\'User\']')}
    get workSpaceMenu (){return $('//android.widget.TextView[@text=\'WorkSpace\']')}
    get noteBooksMenu (){return $('//android.widget.Button[@text=\'Notebooks\']')}
    get backMenuButton (){return $('//android.widget.Button')}
    get getNoteBookProjectName (){return $('//android.widget.TextView[@text=\'Appium Testing Notebook\']')}

    async menuButtonClick(){
        await this.menuButton.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.menuButton.click()
    }

    async backMenuButtonClick(){
        await this.backMenuButton.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.backMenuButton.click()
    }

    async newNoteBookButtonClick(){
        await this.newNoteBookMenu.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.newNoteBookMenu.click()
    }

    async userButtonClick(){
        await this.userMenu.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.userMenu.click()
    }

    async workSpaceButtonClick(){
        await this.workSpaceMenu.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.workSpaceMenu.click()
    }

    async notebooksButtonClick(){
        await this.noteBooksMenu.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.noteBooksMenu.click()
    }

    async getProjectNameFromNoteBook(){
        await this.getNoteBookProjectName.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        return await this.getNoteBookProjectName.getText()
    }

    async projectNameFromNoteBookClick(){
        await this.getNoteBookProjectName.waitForDisplayed({timeout:await this.getWaiterTimeForElement()})
        await this.getNoteBookProjectName.click()
    }

}

export default new MenuFragment()