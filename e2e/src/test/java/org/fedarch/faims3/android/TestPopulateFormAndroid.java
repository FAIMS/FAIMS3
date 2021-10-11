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
 * Filename: TestPopulateFormAndroid.java
 * Description:
 *   TODO
 */

package org.fedarch.faims3.android;

import static org.testng.Assert.assertEquals;

import java.net.MalformedURLException;

import org.fedarch.faims3.TestPopulateForm;
import org.fedarch.faims3.TestUtils;
import org.json.JSONObject;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.annotations.AfterClass;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import io.appium.java_client.MobileBy;
import io.appium.java_client.android.AndroidElement;

/**
 * Test populate the fields on the Android app:
 * https://faimsproject.atlassian.net/browse/FAIMS3-153
 *
 * @author Rini Angreani, CSIRO
 *
 */
public class TestPopulateFormAndroid extends AndroidTest implements TestPopulateForm {

	@BeforeClass
	public void setup() throws MalformedURLException {
		// Test with browserstack by default
		// Change to true for local test connection
		super.setup(false, "Test populate new Test Project observation form (Android)");
	}

	/**
	 * This test scenario is when you put in all the mandatory fields correctly and
	 * then click submit successfully.
	 * Doable Task 2.1 - Observation creation
	 * Doable Task 2.3 - GPS and Taking a Point
	 * @throws Exception
	 */
	@Test
	@Override
	public void testNewObservationWithGPS() throws Exception {

		try {
			// Start a new observation
			loadNewAstroSkyForm();
			// The form should load up
			fillOutFormWithValidFields();
			// validate JSON
			validateJSON();
			// Click save and new
			WebElement submit = TestUtils.scrollToText(driver, "SAVE AND NEW");
			submit.click();

			// Check the message
			verifyMessage("Observation successfully created");

			//return to the projects page
			if (driver.findElementByXPath("//android.widget.Button[@text='Show path']").isDisplayed()) {
				  driver.findElementByXPath("//android.widget.Button[@text='Show path']").click();
			}
			WebDriverWait wait = new WebDriverWait(driver, 10);
			AndroidElement projects = (AndroidElement) wait.until(ExpectedConditions
				  .elementToBeClickable(MobileBy.xpath("//android.widget.TextView[contains(@text, 'Projects')]")));
			projects.click();

			//Load the just-created observation
			wait.until(ExpectedConditions.visibilityOfElementLocated(
					By.xpath("//*[contains(@text, '" + this.recordUuid + "')]"))).click();

			//Ensure that location and change are still present in the data
			validateLatLong();

			TestUtils.scrollToText(driver, "UPDATE");

			WebElement json = wait.until(ExpectedConditions.visibilityOf(
					driver.findElement(MobileBy.xpath("//*[@text='DEVELOPER TOOL: FORM STATE']/following-sibling::android.view.View/android.view.View"))));
			JSONObject jsonObject = new JSONObject(json.getText());
			JSONObject values = jsonObject.getJSONObject("values");

			JSONObject gps = values.getJSONObject("take-point-field");
			assertEquals(this.latitude, gps.get("latitude").toString());
		    assertEquals(this.longitude, gps.get("longitude").toString());
			assertEquals("Change!", values.get("action-field").toString());

		} catch (Exception e) {
			TestUtils.markBrowserstackTestResult(driver, isUsingBrowserstack(), false,
					"Exception " + e.getClass().getSimpleName() + " occurs! See log for details.");
			throw e;
		} catch (AssertionError e) {
			TestUtils.markBrowserstackTestResult(driver, isUsingBrowserstack(), false,
					"Assertion Error: '" + e.getMessage() + "' occurs! See log for details.");
			throw e;
		}
		TestUtils.markBrowserstackTestResult(driver, isUsingBrowserstack(), true,
				"Android - TestPopulateForm.testNewObservationWithGPS() passed!");
	}

	@Override
	@AfterClass
	public void tearDown() {
		super.tearDown();
	}

}
