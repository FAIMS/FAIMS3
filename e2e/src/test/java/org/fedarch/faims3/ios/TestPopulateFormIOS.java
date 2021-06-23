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
 * Filename: TestPopulateFormIOS.java
 * Description:
 *   TODO
 */
package org.fedarch.faims3.ios;

import static org.junit.Assert.assertEquals;

import java.net.MalformedURLException;

import org.fedarch.faims3.TestPopulateForm;
import org.fedarch.faims3.TestUtils;
import org.json.JSONException;
import org.json.JSONObject;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

/**
 * Test populate the fields on the Android app:
 * https://faimsproject.atlassian.net/browse/FAIMS3-153
 *
 * @author Rini Angreani, CSIRO
 *
 */
public class TestPopulateFormIOS extends IOSTest implements TestPopulateForm {

	@BeforeClass
	public static void setup() throws MalformedURLException, JSONException {
		// Test with browserstack by default
		// Change to true for local test connection
		IOSTest.setup(false, "Test populate new Test Project observation form (iOS)");
	}

	/**
	 * This test scenario is when you put in all the mandatory fields correctly and
	 * then click submit successfully.
	 * Doable Task 2.1 - Observation creation
	 * Doable Task 2.3 - GPS and Taking a Point
	 *
	 * @throws JSONException
	 */
	@Test
	@Override
	public void testNewObservationWithGPS() throws JSONException {
		try {
			// Load up Astro Sky form
			loadNewAstroSkyForm();
			// The form should load up
			fillOutFormWithValidFields();
			TestUtils.scrollDown(driver);
			// validate JSON
			validateJSON();
			// Submit button
			WebElement submit = driver.findElement(By.xpath("//button[@type='submit']"));
			submit.click();
			// Check the message
			super.verifyMessage("Observation successfully created");

			//return to the projects page
			WebDriverWait wait = new WebDriverWait(driver, 10);
			WebElement projects = wait.until(ExpectedConditions.elementToBeClickable(
					  By.xpath("//a[@href='/projects']")));
			projects.click();

			//Load the just-created observation
			wait.until(ExpectedConditions.visibilityOfElementLocated(
					By.xpath("//a[@href='/projects/default_test_proj/observations/" + this.recordUuid + "']")))
			           .click();

			//Ensure that location and change are still present in the data
			validateLatLong();

			WebElement json = wait.until(ExpectedConditions.visibilityOf(
					driver.findElement(By.xpath("//*[@id=\"root\"]/div[3]/div[3]/div/form/div/div[3]/div[2]/pre"))));
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
				"iOS - TestPopulateForm.testNewObservationWithGPS() passed!");
	}

	@AfterClass
	public static void tearDown() {
		IOSTest.tearDown();
	}

}