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

import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.nativekey.AndroidKey;
import io.appium.java_client.android.nativekey.KeyEvent;
import io.appium.java_client.pagefactory.AndroidFindBy;
import io.appium.java_client.pagefactory.AppiumFieldDecorator;

/**
 * Page object for editing/adding auto increment id allocations
 * @author Rini Angreani, CSIRO
 */
public class AutoIncrementPage {

	@AndroidFindBy(xpath = "//*[@text='EDIT ALLOCATIONS']")
	@FindBy(xpath = "//a[@href='/projects/default||"
			+ "test_proj/autoincrements/default/basic-autoincrementer-field']")
	private WebElement editAllocations;

	@AndroidFindBy(xpath = "//*[@text = 'No ranges allocated yet.']")
	@FindBy(xpath = "//*[text() = 'No ranges allocated yet.']")
	private WebElement noRangesAllocatedYet;

	@AndroidFindBy(xpath = "//*[@text = 'ADD NEW RANGE!']")
	@FindBy(xpath = "//*[text() = 'Add new range!']")
	private WebElement addNewRange;

	@AndroidFindBy(xpath = "//*[@resource-id='start']")
	@FindBy(id = "start")
	private WebElement start;

	@AndroidFindBy(xpath = "//*[@resource-id='stop']")
	@FindBy(id = "stop")
	private WebElement stop;

	@AndroidFindBy(xpath = "//*[@text = 'UPDATE RANGE']")
	@FindBy(xpath = "//*[text() = 'Update range']")
	private WebElement updateRange;

	private WebDriverWait wait;

	private WebDriver driver;

	public AutoIncrementPage(WebDriver driver) {
		this.driver = driver;
		wait = new WebDriverWait(driver, 20);
		PageFactory.initElements(new AppiumFieldDecorator(driver), this);
	}

	/**
	 * Check if any id range has been allocated.
	 *
	 * @return true if range exists
	 */
	public boolean anyRangesAllocated() {
		wait.until(ExpectedConditions.visibilityOf(this.addNewRange));
		return !this.noRangesAllocatedYet.isDisplayed();
	}

	public void createNewRangeIfNoDefault() {
		this.editAllocations.click();
		if (!anyRangesAllocated()) {
			// create new range if there isn't existing one yet
			this.addNewRange.click();
			// Enter new range values
			wait.until(
					ExpectedConditions.visibilityOf(this.start));

			this.start.click();
			if (driver instanceof AndroidDriver) {
				((AndroidDriver) driver).pressKey(new KeyEvent(AndroidKey.DIGIT_1));
			} else {
				this.start.sendKeys("1");
			}

			this.stop.click();
			if (driver instanceof AndroidDriver) {
				((AndroidDriver) driver).pressKey(new KeyEvent(AndroidKey.DIGIT_5));
			    // Hide the number keyboard so we can see the rest of the screen
		    	((AndroidDriver) driver).hideKeyboard();
			} else {
				this.stop.sendKeys("5");
			}

			// submit new range
			this.updateRange.click();
		}
	}
}
