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

import org.fedarch.faims3.TestUtils;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import io.appium.java_client.MobileBy;
import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.ios.IOSDriver;
import io.appium.java_client.pagefactory.AndroidFindBy;
import io.appium.java_client.pagefactory.AppiumFieldDecorator;
import io.appium.java_client.pagefactory.iOSXCUITFindBy;

/**
 * Page object for listing projects and their records
 * @author Rini Angreani, CSIRO
 */
public class ProjectsPage {
	@AndroidFindBy(xpath = "//*[contains(@text, 'Astrosky')]")
	@FindBy(xpath = "//div[@class='MuiCardHeader-content']/span/div/b[contains(., 'Astrosky')]")
	private WebElement astroSky;

	@AndroidFindBy(xpath = "//*[contains(@text, 'Astrosky')]/..")
	@AndroidFindBy(xpath = "//*[@text='settings']")
	@iOSXCUITFindBy(xpath = "(//XCUIElementTypeButton[@name=\"settings\"])[1]")
	@FindBy(xpath = "//div[@class='MuiCardHeader-content']/span/div/b[contains(., 'Astrosky')]/../../../..//button[span='New Record']")
	private WebElement projectMenuButton;

	@AndroidFindBy(xpath = "//*[@text='Project Settings']")
	@FindBy(xpath = "//a[@href='/projects/default||test_proj/settings']")
	private WebElement projectSettingsLink;

	@AndroidFindBy(xpath = "//*[@text='New astro_sky::main']")
	@iOSXCUITFindBy(xpath = "//XCUIElementTypeMenuItem[@name=\"New Observation\"]")
	@FindBy(xpath = "//a[@href='/projects/default||test_proj/new/astro_sky::main']")
	private WebElement newAstroSkyMain;

	private WebDriver driver;

	private WebDriverWait wait;

	private AutoIncrementPage autoIncrementPage;

	private IndexPage indexPage;

	private ProjectSettingsPage projectSettingsPage;

	public ProjectsPage(WebDriver driver) {
		this.driver = driver;
		wait = new WebDriverWait(driver, 20);
		PageFactory.initElements(new AppiumFieldDecorator(driver), this);
		this.autoIncrementPage = new AutoIncrementPage(driver);
		this.indexPage = new IndexPage(driver);
		this.projectSettingsPage = new ProjectSettingsPage(driver);
	}

	/**
	 * Check if auto increments settings has an entry. If not, create a new one.
	 */
	public void checkAutoIncrement() {
		loadAstroSkyProject();
		// Go to settings -> edit auto increment allocations
		if (driver instanceof AndroidDriver || driver instanceof IOSDriver) {
		    this.projectMenuButton.click();
		}
		this.projectSettingsLink.click();
		this.projectSettingsPage.editAutoIncrementAllocations();
		// Create new range if none exists
		this.autoIncrementPage.createNewRangeIfNoDefault();
		// return to Index
		indexPage.returnToIndex();
	}

	/**
	 * Load up new test AstroSky main form
	 */
	public void loadNewAstroSkyForm() {
		loadAstroSkyProject();

		// Find the '+' button
		this.projectMenuButton.click();
		this.newAstroSkyMain.click();
	}

	/**
	 * Load AstroSky project from home
	 */
	public void loadAstroSkyProject() {
		// TODO: remove when FAIMS3-297 is fixed
		// temporary workaround for the bug
		try {
			Thread.sleep(12000);
		} catch (InterruptedException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}

		indexPage.loadProjects();

		// Get the right project
		wait.until(ExpectedConditions.visibilityOf(this.astroSky));

		// workaround for FAIMS3-263
		try {
			Thread.sleep(3000);
		} catch (InterruptedException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	public void loadObservationDraft(String draftId) {
		String xpath;

		if (driver instanceof AndroidDriver) {
			String draftXpath = "//*[@text='NEW DRAFT']/following-sibling::android.widget.GridView";
			WebElement draftGrid = wait.until(ExpectedConditions.visibilityOfElementLocated(
					By.xpath(draftXpath)));
			draftGrid.findElement(MobileBy.xpath(
					"//*[contains(@text, '" + draftId + "')]"))
			            .click();
		} else if (driver instanceof IOSDriver) {
			//TODO
		} else {
			xpath = "//*[@data-value='" + draftId + "' and @data-field='_id']/a";
			wait.until(ExpectedConditions.visibilityOfElementLocated(By.xpath(xpath)))
					.click();
		}
	}

	public void loadObservationRecord(String recordId) {
		if (driver instanceof AndroidDriver) {
			TestUtils.scrollToText(driver, recordId);

			WebElement recentRecordsGrid = driver.findElement(MobileBy.xpath(
					"//*[@text='RECENT RECORDS']/following-sibling::android.widget.GridView"));
			recentRecordsGrid.findElement(MobileBy.xpath(
					"//*[contains(@text, '" + recordId + "')]"))
			            .click();
		} else if (driver instanceof IOSDriver) {
			//TODO
		} else {
			String xpath = "//*[@data-value='" + recordId + "' and @data-field='record_id']/a";
			driver.findElement(By.xpath(xpath)).click();
		}

	}

	/**
	 * Get the first existing records in "Recent Records" and open it.
	 */
	public String loadFirstObservationRecord() {
		String recordId = null;
		TestUtils.scrollToText(driver, "RECENT RECORDS");
		// Scroll down to see the table
		TestUtils.scrollDown(driver);
		if (driver instanceof AndroidDriver) {
			WebElement recentRecordsGrid = driver.findElement(MobileBy.xpath(
					"//*[@text='RECENT RECORDS']/following-sibling::android.widget.GridView"));
			// Unfortunately there's no other way...
			// TODO fix this when we have HRID in the records list
			// it should be easier then
			WebElement firstRecord = recentRecordsGrid.findElement(
					MobileBy.xpath("(//android.widget.CheckBox)[2]/../../"
							+ "following-sibling::android.view.View"));
			recordId = firstRecord.getText();
			firstRecord.click();
		} else if (driver instanceof IOSDriver) {
			//TODO
		} else {
			WebElement firstRecord = driver.findElement(By.xpath("//*[@data-field='record_id']"));
			recordId = firstRecord.getAttribute("data-value");
			firstRecord.findElement(By.tagName("a")).click();
		}
		return recordId;

	}

	public void loadProjects() {
		this.indexPage.loadProjects();
	}


}
