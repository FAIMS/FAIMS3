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
 * Filename: TestStagingFormAndroid.java
 * Description:
 *   TODO
 */

package org.fedarch.faims3;

import java.lang.reflect.InvocationTargetException;
import java.net.MalformedURLException;

import org.fedarch.faims3.pages.AstroSkyMainPage;
import org.fedarch.faims3.pages.ProjectsPage;
import org.json.JSONException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.testng.AssertJUnit;
import org.testng.annotations.AfterClass;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Optional;
import org.testng.annotations.Parameters;
import org.testng.annotations.Test;

import io.appium.java_client.android.AndroidDriver;

/**
 * Test creating an observation draft:
 * https://faimsproject.atlassian.net/browse/FAIMS3-153
 *
 * @author Rini Angreani, CSIRO
 *
 */
public class TestStagingForm {
	protected AstroSkyMainPage astroSky;

	protected ProjectsPage projects;

	private WebDriver driver;

	private String description;

	@BeforeClass
	@Parameters({ "driver", "runLocally"})
	public void setup(String driverType, @Optional("false") boolean runLocally)
			throws MalformedURLException, JSONException {
		this.description = "Test create new draft for AstroSky observation form ("
	        + driverType + ")";
	    this.driver = WebDriverFactory.createDriver(driverType, runLocally, description);
		this.projects = new ProjectsPage(driver);
		this.astroSky = new AstroSkyMainPage(driver);
	}

	/**
	 * This test scenario is when you put in all the mandatory fields and switch to
	 * another project on the top tab. When you open the form again, it should have
	 * saved the previous values.
	 *
	 * @throws JSONException
	 * @throws MalformedURLException
	 * @throws NoSuchMethodException
	 * @throws SecurityException
	 * @throws IllegalAccessException
	 * @throws IllegalArgumentException
	 * @throws InvocationTargetException
	 */
	@Test
	public void testNewObservationDraft() throws Exception {
		try {
			// Start a new observation
			projects.loadNewAstroSkyForm();
			// The form should load up
			astroSky.fillOutFormWithValidFields();
			// validate JSON
			astroSky.validateJSON();
			// remember draft id for next tests
			String draftId = astroSky.getDraftId();
			// return to the projects page
			astroSky.leaveObservationForm();
			// Load the just-created observation
			projects.loadObservationDraft(draftId);
			// Ensure that location and change are still present in the data
			astroSky.checkLatLongValues();

			WebElement email = TestUtils.scrollToId(driver, "email-field");
			AssertJUnit.assertEquals(AstroSkyMainPage.EMAIL_ANDROID, email.getText());

			WebElement colour = TestUtils.scrollToId(driver, "str-field");
			AssertJUnit.assertEquals(AstroSkyMainPage.COLOUR, colour.getText());

			WebElement unicode = TestUtils.scrollToId(driver, "multi-str-field");
			AssertJUnit.assertEquals(AstroSkyMainPage.UNICODE, unicode.getText());

			WebElement multiCurr = TestUtils.scrollToId(driver, "multi-select-field");
			if (driver instanceof AndroidDriver) {
			    AssertJUnit.assertEquals("Currencies $, €", multiCurr.getText());
			} else {
				AssertJUnit.assertEquals("$, €", multiCurr.getText());
			}

			AssertJUnit.assertEquals("true", astroSky.isCheckBoxChecked());

			// the fourth radio button should be selected
			WebElement radioField = TestUtils.scrollToId(driver, "radio-group-field-4");
			AssertJUnit.assertEquals("true", radioField.getAttribute("checked"));

			// Second page
			TestUtils.scrollToText(driver, "next-view").click();
			AssertJUnit.assertEquals(AstroSkyMainPage.INTEGER, astroSky.getIntFieldValue());
			String currency = astroSky.getCurrencyValue();
			if (driver instanceof AndroidDriver) {
			    AssertJUnit.assertEquals("Currencies $, €", currency);
			} else {
				AssertJUnit.assertEquals("$, €", currency);
			}

			// Make sure JSON is still the same
			astroSky.validateJSON();
		} catch (Exception e) {
			TestUtils.markBrowserstackTestResult(driver, false,
					"Exception " + e.getClass().getSimpleName() + " occurs! See log for details.");
			throw e;
		} catch (AssertionError e) {
			TestUtils.markBrowserstackTestResult(driver, false,
					"Assertion Error: '" + e.getMessage() + "' occurs! See log for details.");
			throw e;
		}
		// if we make it to the end with no exceptions, that means we passed!
		TestUtils.markBrowserstackTestResult(driver, true, this.description + " passed!");

	}

	@AfterClass
	public void tearDown() {
	    this.driver.quit();
	}

}
