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
 * Filename: TestUpdateObservationsandDraftDatabase.java
 * Description:
 *   TODO
 */
package org.fedarch.faims3;

import static org.testng.Assert.assertEquals;

import java.net.MalformedURLException;

import org.fedarch.faims3.android.AndroidTest;
import org.fedarch.faims3.chrome.ChromeTest;
import org.fedarch.faims3.ios.IOSTest;
import org.json.JSONException;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.annotations.AfterClass;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import io.appium.java_client.MobileBy;
import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.AndroidElement;
/**
 * Doable task 2.4 - Update Observations and the Draft Database
 * In this task, we demonstrate the robust append-only datastore provided by CouchDB.
 * We also demonstrate how leaving a new observation-in-progress to update a different observation,
 * or editing multiple observations in pseudo-parallel (i.e. not finalising the updates to be synced
 * to other devices) is entirely supported by the draft-database infrastructure provided.
 *
 * @author Rini Angreani, CSIRO
 */

public class TestUpdateObservationsAndDraftDatabase {
	// Android instance
	private AndroidTest androidDevice;

	// iOS instance
	private IOSTest iosDevice;

	// Chrome instance
	private ChromeTest chromeDevice;

	@BeforeClass
	public void setup() throws MalformedURLException, JSONException {
		// Test with browserstack by default
		// Change to true for local test connection
		androidDevice = new AndroidTest();
		androidDevice.setup(false, "Test update observations and draft database (multi platform/parallel)");

		chromeDevice = new ChromeTest();
		chromeDevice.setup(false, "Test update observations and draft database (multi platform/parallel)");

		iosDevice = new IOSTest();
		iosDevice.setup(false,  "Test update observations and draft database (multi platform/parallel)");
	}

	@AfterClass
	public void tearDown() {
		// Quit all the drivers
		androidDevice.tearDown();
		chromeDevice.tearDown();
		iosDevice.tearDown();
	}

	/**
	 * Task 2.4.1 - Updating an Observation
	 * Relates to: FAIMS3-190: As a test user, I want to load and update a record
	 * @throws Exception
	 * @throws InterruptedException
	 */
	@Test
	public void testUpdateObservation() throws Exception {
		WebDriver driver = androidDevice.driver;
		try {
			// Navigate to the projects view
			androidDevice.loadProjects();

			// Load a observation of your choice.
			// Note the first 6 characters of the UUID here (for ease of future reference)
			String uuid = androidDevice.getRecordUuid();
			androidDevice.loadObservationForm(uuid);
			// Manually increment number of revisions every time we save to compare later
			int revisionCount = androidDevice.getRevisions().length;

			// Edit data. Wait for the draft to save, leave the observation
			WebDriverWait androidWait = new WebDriverWait(driver, 20);
			AndroidElement strField = (AndroidElement) androidWait.until(
					ExpectedConditions.presenceOfElementLocated(MobileBy.xpath("//*[@resource-id='str-field']")));

			final String FIRST_EDIT_ANDROID = "Green";
			strField.sendKeys(FIRST_EDIT_ANDROID);
			Thread.sleep(2000);
			androidDevice.leaveObservationForm();

			// Load the observation on a different device – observe that your changes have
			// not propagated
			driver = chromeDevice.driver;
			chromeDevice.loadProjects();
			chromeDevice.loadObservationForm(uuid);
			WebDriverWait chromeWait = new WebDriverWait(driver, 20);
			WebElement chromeStrField = chromeWait
					.until(ExpectedConditions.presenceOfElementLocated(By.id("str-field")));
			assertEquals(chromeStrField.getText(), AstroSky.COLOUR);

			// On the original device, start a new observation, wait for the draft to save,
			// leave the observation
			driver = androidDevice.driver;
			androidDevice.loadNewAstroSkyForm();
			AndroidElement newStrField = (AndroidElement) androidWait.until(
					ExpectedConditions.presenceOfElementLocated(MobileBy.xpath("//*[@resource-id='str-field']")));

			final String ANDROID_DRAFT_EDIT = "Grey";
			newStrField.sendKeys(ANDROID_DRAFT_EDIT);
			Thread.sleep(2000);
			androidDevice.leaveObservationForm();

			// Still on the original device, return to the observation you were initially
			// editing, note that your edits were preserved
			androidDevice.loadObservationForm(uuid);
			strField = (AndroidElement) androidWait.until(
					ExpectedConditions.presenceOfElementLocated(MobileBy.xpath("//*[@resource-id='str-field']")));
			assertEquals(strField.getText(), FIRST_EDIT_ANDROID);

			// Finish editing data, press UPDATE
			TestUtils.scrollToText((AndroidDriver<AndroidElement>) driver, "UPDATE").click();
			revisionCount++;

			// Edit data again, press UPDATE again
			TestUtils.scrollToText(androidDevice.driver, FIRST_EDIT_ANDROID);
			strField = (AndroidElement) androidWait.until(
					ExpectedConditions.presenceOfElementLocated(MobileBy.xpath("//*[@resource-id='str-field']")));
			strField.sendKeys("Black");
			TestUtils.scrollToText((AndroidDriver<AndroidElement>) driver, "UPDATE").click();
			revisionCount++;

			// Click new observation and ensure that your draft new observation is still
			// there.
			androidDevice.leaveObservationForm();
			androidDevice.loadNewAstroSkyForm();
			newStrField = (AndroidElement) androidWait.until(
					ExpectedConditions.presenceOfElementLocated(MobileBy.xpath("//*[@resource-id='str-field']")));
			assertEquals(newStrField.getText(), ANDROID_DRAFT_EDIT);

			// Return to the edited observation.
			androidDevice.leaveObservationForm();
			androidDevice.loadObservationForm(uuid);

			// Verify that a new revision has been created by selecting the REVISIONS tab at
			// the top of the screen. This will show the ID for each of the revisions of the
			// observation.
			int numRevisions = androidDevice.getRevisions().length;
			assertEquals(numRevisions, revisionCount);
		} catch (Exception e) {
			TestUtils.markBrowserstackTestResult(driver, androidDevice.isUsingBrowserstack(), false,
					"Exception " + e.getClass().getSimpleName() + " occurs! See log for details.");
			throw e;
		} catch (AssertionError e) {
			TestUtils.markBrowserstackTestResult(driver, androidDevice.isUsingBrowserstack(), false,
					"Assertion Error: '" + e.getMessage() + "' occurs! See log for details.");
			throw e;
		}
		TestUtils.markBrowserstackTestResult(driver, androidDevice.isUsingBrowserstack(), true,
				"Android - TestPopulateForm.testNewObservationWithGPS() passed!");
    }

	/**
	 * Task 2.4.2 - Draft database data preservation during updates
	 * This task demonstrates that the “Draft database” also caches edits-in-progress as well
	 * as new-observations-in-progress. Here we are performing the inverse of task 2.2 –
	 * editing a observation, pausing our edits, creating a new observation, and then resuming our edits.
	 */
	@Test
	public void testDatabaseDataPreservation() {
	//Edit an observation on the browser but do not press update

    //What are the first 6 characters of this observation’s UUID?

    //Return to the observations list

    //On the browser, Press + New Observation
    //Fill out a new observation, allow autosave to occur, press SAVE AND NEW
    //Leave the New Observation view
    //On the browser, Resume editing the observation in step 1
    //Observe persistence of changes
    //Load the same observation in a different platform
    //Observe that the draft database has not synchronised the latest, unsaved changes, but has synchronised the new observation. Leave the observation.
    //In the first browser, press update on the edit-in-progress
    //Allow the application to sync
    //Observe observations on other devices after they sync – verify that only the latest data appears, but the list of all revisions is shown in the REVISIONS tab.

	}


}