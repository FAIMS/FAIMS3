/*
 * Copyright 2021 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: AstroSky.java
 * Description:
 *   TODO
 */

package org.fedarch.faims3.pages;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import io.appium.java_client.pagefactory.AndroidFindBy;
import io.appium.java_client.pagefactory.AppiumFieldDecorator;
import io.appium.java_client.pagefactory.iOSXCUITFindBy;

/**
 * Page object for index page.
 * @author Rini Angreani, CSIRO
 */
public class IndexPage {

	@AndroidFindBy(xpath = "//*[@text='open drawer']")
    @FindBy(xpath = "//*[@aria-label='open drawer']")
	private WebElement leftSideMenu;

	@AndroidFindBy(xpath = "//*[@text='Home']")
    @FindBy(xpath = "//*[text()='Home']")
	private WebElement homeMenu;

    @AndroidFindBy(xpath = "//*[@text='Index']")
	private WebElement indexLink;

	@AndroidFindBy(xpath = "//android.view.MenuItem[contains(@text, 'Projects')]")
	@iOSXCUITFindBy(xpath = "//XCUIElementTypeMenuItem[@name=\"Projects\"]")
	@FindBy(xpath = "//a[@href='/projects']")
	private WebElement projects;

	private WebDriverWait wait;

	public IndexPage(WebDriver driver) {
		wait = new WebDriverWait(driver, 20);
		PageFactory.initElements(new AppiumFieldDecorator(driver), this);
	}

	/**
	 * Return to index page via the link on top
	 */
	public void returnToIndex() {
		this.indexLink.click();
	}
	/**
	 * Load all projects
	 */
	public void loadProjects() {
		// Click on "Projects"
		wait.until(ExpectedConditions
				.elementToBeClickable(this.projects))
		            .click();
	}
}
